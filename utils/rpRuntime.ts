import type { TextChannel } from 'discord.js';
import { matchMentions, formatCharHandle } from './rpIdentity';
import { generateRpReply } from './rpChat';
import { sendAsCharacter } from './rpDelivery';
import { logError } from './log';

/**
 * Runtime glue for roleplay: routes channel messages to spawned characters and runs
 * the proactive "all"-mode replies. Generation is throttled (only on a direct mention,
 * or one proactive reply per channel per scheduler tick); bot/webhook messages never
 * reach here (processMessage drops them), so characters never hear each other.
 *
 * `activeRpChannels` is an in-memory fast-path: the message router returns instantly
 * unless the channel actually has a spawn, so normal traffic never touches the DB.
 */

const activeRpChannels = new Set<string>();

/** Rebuilds the active-channel set from the DB (call on boot). */
export async function recomputeActiveRpChannels(db: any): Promise<void> {
  try {
    const channels = await db.rp.getDistinctActiveChannels();
    activeRpChannels.clear();
    channels.forEach((c: string) => activeRpChannels.add(c));
  } catch (err) {
    logError('Rp: failed to recompute active channels:', err);
  }
}

export function markRpChannelActive(channelId: string): void {
  activeRpChannels.add(channelId);
}

/** Drops a channel from the fast-path set if it no longer has active spawns. */
export async function refreshRpChannel(db: any, channelId: string): Promise<void> {
  const count = await db.rp.countActiveSpawnsInChannel(channelId);
  if (count > 0) activeRpChannels.add(channelId);
  else activeRpChannels.delete(channelId);
}

interface RespondOpts {
  replyToUrl?: string | null;
  replyToLabel?: string | null;
  /** Surface a notice to the user (router uses message.reply); omit to stay silent on errors. */
  notify?: (text: string) => Promise<void>;
}

/**
 * Generates and delivers one reply for a spawned character. Assumes any incoming user
 * turn is already recorded. Records the model turn on success; surfaces compaction
 * failure (and re-mention recovery is handled inside generateRpReply).
 */
async function respondAsCharacter(
  client: any,
  db: any,
  channel: TextChannel,
  row: any,
  opts: RespondOpts = {},
): Promise<void> {
  channel.sendTyping?.().catch(() => {});

  const result = await generateRpReply(db, {
    spawnId: row.spawnId,
    compactionEnabled: row.compactionEnabled === 1,
    compactedMemory: row.compactedMemory ?? null,
    compactedUptoId: row.compactedUptoId ?? null,
    compactionFailed: row.compactionFailed === 1,
  }, {
    charId: row.charId,
    name: row.charName,
    details: row.charDetails,
    startingMessage: row.charStartingMessage,
  });

  if (result.ok) {
    await db.rp.addHistory(row.spawnId, 'model', result.text);
    await db.rp.touchSpawnActivity(row.spawnId);
    await sendAsCharacter({
      client,
      db,
      channel,
      character: {
        charId: row.charId,
        name: row.charName,
        pfpUrl: row.charPfpUrl,
        pfpMessageId: row.charPfpMessageId,
        pfpChannelId: row.charPfpChannelId,
      },
      text: result.text,
      replyToUrl: opts.replyToUrl,
      replyToLabel: opts.replyToLabel,
    });
    return;
  }

  if (result.reason === 'compaction_failed') {
    const notice = `⚠️ **${row.charName}** has run out of context and automatic compaction failed. `
      + 'Mention them again to retry — if it keeps failing the oldest messages will be dropped instead.';
    if (opts.notify) await opts.notify(notice);
    else await channel.send({ content: notice, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }

  // Generic error: surface only when a user is waiting (mention path), else stay quiet.
  if (opts.notify) {
    await opts.notify(`⚠️ **${row.charName}** couldn't respond right now. Try again in a moment.`);
  }
}

/**
 * Message-router entry point. Records the message into every spawn that "hears" it
 * (all-mode hears everyone; self-mode hears only its spawner), then fires immediate
 * replies for any characters the message directly @mentions.
 */
export async function handleRpMessage(client: any, message: any): Promise<void> {
  const db = client.db;
  const channelId = message.channel.id;
  if (!activeRpChannels.has(channelId)) return;

  let spawns: any[];
  try {
    spawns = await db.rp.getActiveSpawnsInChannel(channelId);
  } catch (err) {
    logError('Rp: failed to load spawns for channel:', err);
    return;
  }
  if (spawns.length === 0) { activeRpChannels.delete(channelId); return; }

  const content = message.content ?? '';
  const authorId = message.author.id;
  const speakerName = message.member?.displayName || message.author.username;

  // All-mode characters hear the whole channel; record every message as context.
  // Self-mode characters only register their spawner's directed mentions (below).
  const heard = spawns.filter((s) => s.interactability === 'all');
  await Promise.all(heard.map(async (s) => {
    await db.rp.addHistory(s.spawnId, 'user', content, { id: authorId, name: speakerName });
    await db.rp.touchSpawnActivity(s.spawnId);
  }));

  if (!content.includes('@')) return;

  const spawnLikes = spawns.map((s) => ({ spawnId: s.spawnId, charId: s.charId, nameLower: s.charNameLower }));
  const { matched, ambiguous } = matchMentions(content, spawnLikes);

  for (const amb of ambiguous) {
    const lines = amb.candidates
      .map((c) => {
        const sp = spawns.find((s) => s.spawnId === c.spawnId);
        return sp ? `• \`${formatCharHandle(sp.charName, sp.charId)}\`` : null;
      })
      .filter(Boolean)
      .join('\n');
    // eslint-disable-next-line no-await-in-loop
    await message.reply({
      content: `\`@${amb.token}\` matches multiple characters here — be more specific:\n${lines}`,
      allowedMentions: { repliedUser: false },
    }).catch(() => {});
  }

  for (const sl of matched) {
    const spawn = spawns.find((s) => s.spawnId === sl.spawnId);
    if (!spawn) continue;
    if (spawn.interactability === 'self') {
      // Self-mode ignores everyone but its spawner, and records only directed mentions
      // (all-mode mentions were already recorded by the "heard" pass above).
      if (authorId !== spawn.spawnerId) continue;
      // eslint-disable-next-line no-await-in-loop
      await db.rp.addHistory(spawn.spawnId, 'user', content, { id: authorId, name: speakerName });
      // eslint-disable-next-line no-await-in-loop
      await db.rp.touchSpawnActivity(spawn.spawnId);
    }
    const jump = `https://discord.com/channels/${message.guildId}/${channelId}/${message.id}`;
    // eslint-disable-next-line no-await-in-loop
    await respondAsCharacter(client, db, message.channel as TextChannel, spawn, {
      replyToUrl: jump,
      replyToLabel: speakerName,
      notify: (t: string) => message.reply({ content: t, allowedMentions: { repliedUser: false } })
        .then(() => {}).catch(() => {}),
    });
  }
}

/**
 * One scheduler tick: each active "all"-mode character with an un-answered user turn
 * is a candidate; we fire at most one proactive reply per channel (so 5 characters
 * don't all pile on). Channels with nothing new stay dormant (hibernation).
 */
export async function runProactiveRpTick(client: any): Promise<void> {
  if (typeof client.isReady === 'function' && !client.isReady()) return;
  const db = client.db;

  let spawns: any[];
  try {
    spawns = await db.rp.getActiveAllSpawns();
  } catch (err) {
    logError('Rp: failed to load all-mode spawns:', err);
    return;
  }
  if (spawns.length === 0) return;

  const byChannel = new Map<string, any[]>();
  for (const s of spawns) {
    const list = byChannel.get(s.channelId) ?? [];
    list.push(s);
    byChannel.set(s.channelId, list);
  }

  for (const [channelId, list] of byChannel) {
    const candidates: any[] = [];
    for (const s of list) {
      // eslint-disable-next-line no-await-in-loop
      const lastRole = await db.rp.getLastHistoryRole(s.spawnId);
      if (lastRole === 'user') candidates.push(s);
    }
    if (candidates.length === 0) continue;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    // eslint-disable-next-line no-await-in-loop
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') continue;
    // eslint-disable-next-line no-await-in-loop
    await respondAsCharacter(client, db, channel as TextChannel, chosen, {});
  }
}
