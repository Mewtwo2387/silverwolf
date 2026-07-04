import type { TextChannel } from 'discord.js';
import { matchMentions, formatCharHandle } from './rpIdentity';
import { generateRpReply } from './rpChat';
import {
  sendAsCharacter, postCharacterPlaceholder, editCharacterReply, deleteCharacterPlaceholder, isRpWebhookId,
} from './rpDelivery';
import { logError } from './log';

/**
 * Runtime glue for roleplay: routes channel messages to spawned characters and runs
 * the proactive "all"-mode replies. Generation is throttled (only on a direct mention,
 * or one proactive reply per channel per scheduler tick).
 *
 * Bot/webhook/app messages ARE heard (recorded as context, tagged from_bot) so a
 * character is aware of what other bots — including other RP characters — said, but
 * they can never *trigger* a reply: only an unanswered human turn does. That's the
 * loop guard (a character replying can't set off another character replying forever).
 * A character's own webhook output isn't echoed back into history here — it's fed to
 * the other characters directly at generation time (see propagateReplyToChannel), so
 * they get the real reply text rather than the "*typing*" placeholder.
 *
 * `activeRpChannels` is an in-memory fast-path: the message router returns instantly
 * unless the channel actually has a spawn, so normal traffic never touches the DB.
 */

const activeRpChannels = new Set<string>();

// Spawn ids currently generating/delivering a reply. The message router (fire-and-
// forget) and the 30s proactive scheduler can both target the same spawn at once;
// this serializes them so they can't read the same last user turn and post duplicate
// or out-of-order replies. Single process, so an in-memory lock suffices.
const inFlightSpawns = new Set<number>();

/** Sizes of the runtime's in-memory sets, for /dev ramstats diagnostics. */
export function getRpRuntimeStats(): { activeChannels: number; inFlightSpawns: number } {
  return { activeChannels: activeRpChannels.size, inFlightSpawns: inFlightSpawns.size };
}

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
  /** Self-mode: the spawner's name for `{user}` substitution. Null in all-mode. */
  userVar?: string | null;
  /** Surface a notice to the user (router uses message.reply); omit to stay silent on errors. */
  notify?: (text: string) => Promise<void>;
}

/**
 * After a character speaks, feed its reply to the OTHER "all"-mode characters in the
 * same channel as context (from_bot, so it never triggers them → no bot loop). Done
 * here rather than from the webhook echo so they get the final reply text — correctly
 * attributed and free of the "*typing*" placeholder.
 */
async function propagateReplyToChannel(
  db: any,
  channelId: string,
  authoringSpawnId: number,
  charName: string,
  text: string,
): Promise<void> {
  let spawns: any[];
  try {
    spawns = await db.rp.getActiveSpawnsInChannel(channelId);
  } catch (err) {
    logError('Rp: failed to propagate reply to channel:', err);
    return;
  }
  await Promise.all(
    spawns
      .filter((s) => s.interactability === 'all' && s.spawnId !== authoringSpawnId)
      .map(async (s) => {
        // Isolate per-spawn: a transient DB error while sharing context with one
        // character must not reject back into respondAsCharacter (which only has a
        // finally), or it would abort the rest of the mention loop / scheduler tick.
        try {
          await db.rp.addHistory(s.spawnId, 'user', text, { id: null, name: charName }, true);
          await db.rp.touchSpawnActivity(s.spawnId);
        } catch (err) {
          logError(`Rp: failed to propagate reply to spawn ${s.spawnId}:`, err);
        }
      }),
  );
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
  const spawnId: number = row.spawnId;
  // Drop overlapping triggers for the same spawn (see inFlightSpawns above). The
  // skipped trigger's message is already in history, so the in-flight reply picks it up.
  if (inFlightSpawns.has(spawnId)) return;
  inFlightSpawns.add(spawnId);
  try {
    const character = {
      charId: row.charId,
      name: row.charName,
      pfpUrl: row.charPfpUrl,
      pfpMessageId: row.charPfpMessageId,
      pfpChannelId: row.charPfpChannelId,
    };

    // Post "typing.  .  ." as the character right away, then edit it into the reply —
    // the wait reads as the character thinking rather than "Silverwolf is typing".
    const typing = await postCharacterPlaceholder({
      client, db, channel, character,
    });

    // Personas apply to self-mode only (1-1 roleplay): the spawner is the one person
    // the character talks to, so their persona is unambiguous. All-mode has no single
    // "the user", so personas are skipped there.
    let persona: string | null = null;
    if (row.interactability === 'self') {
      try {
        persona = (await db.rp.getPersona(row.spawnerId))?.details ?? null;
      } catch (err) {
        logError(`Rp: failed to load persona for user ${row.spawnerId}:`, err);
      }
    }

    const result = await generateRpReply(db, {
      spawnId,
      compactionEnabled: row.compactionEnabled === 1,
      compactedMemory: row.compactedMemory ?? null,
      compactedUptoId: row.compactedUptoId ?? null,
      compactionFailed: row.compactionFailed === 1,
    }, {
      charId: row.charId,
      name: row.charName,
      details: row.charDetails,
      startingMessage: row.charStartingMessage,
    }, opts.userVar ?? null, persona);

    if (result.ok) {
      // Deliver first; only persist the model turn once it actually reached the
      // channel, so a webhook failure can't seed history with a line nobody saw.
      const delivered = typing
        ? await editCharacterReply(typing, {
          text: result.text, replyToUrl: opts.replyToUrl, replyToLabel: opts.replyToLabel,
        })
        : await sendAsCharacter({
          client,
          db,
          channel,
          character,
          text: result.text,
          replyToUrl: opts.replyToUrl,
          replyToLabel: opts.replyToLabel,
        });
      if (delivered) {
        await db.rp.addHistory(spawnId, 'model', result.text);
        await db.rp.touchSpawnActivity(spawnId);
        // Let the other "all"-mode characters here hear what this one just said.
        await propagateReplyToChannel(db, channel.id, spawnId, row.charName, result.text);
        return;
      }
      // Delivery failed — clear any dangling placeholder and don't record the turn.
      if (typing) await deleteCharacterPlaceholder(typing);
      if (opts.notify) {
        await opts.notify(`⚠️ **${row.charName}** couldn't post its reply right now. Try again in a moment.`);
      }
      return;
    }

    // Generation failed — clear the dangling "typing…" before surfacing anything.
    if (typing) await deleteCharacterPlaceholder(typing);

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
  } finally {
    inFlightSpawns.delete(spawnId);
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
  const isBot = !!(message.author?.bot || message.webhookId);
  // Our own character output arrives here as a webhook message too. Skip it — the
  // reply is fed to the other characters at generation time (propagateReplyToChannel)
  // with the real text, so echoing the raw "*typing*" placeholder would only pollute
  // their context. Identify it by *our* RP webhook id (only we can post through it)
  // plus a username matching a spawned character, so another app that reuses a
  // character's name (a different webhook) is still heard normally.
  const isOwnRpOutput = isRpWebhookId(message.webhookId)
    && spawns.some((s) => s.charName === message.author?.username);

  // All-mode characters hear the whole channel — humans AND other bots/apps — as
  // context (bot turns tagged so they can't trigger a reply). Self-mode characters
  // only register their spawner's directed mentions (below).
  if (!isOwnRpOutput) {
    const heard = spawns.filter((s) => s.interactability === 'all');
    await Promise.all(heard.map(async (s) => {
      await db.rp.addHistory(s.spawnId, 'user', content, { id: authorId, name: speakerName }, isBot);
      await db.rp.touchSpawnActivity(s.spawnId);
    }));
  }

  // Bots/webhooks/apps are heard but can never trigger a reply — the loop guard.
  if (isBot) return;

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
    // Self-mode substitutes {user} with the spawner (who is the only one talking to it).
    const userVar = spawn.interactability === 'self' ? speakerName : null;
    // eslint-disable-next-line no-await-in-loop
    await respondAsCharacter(client, db, message.channel as TextChannel, spawn, {
      replyToUrl: jump,
      replyToLabel: speakerName,
      userVar,
      notify: (t: string) => message.reply({ content: t, allowedMentions: { repliedUser: false } })
        .then(() => {}).catch(() => {}),
    });
  }
}

/**
 * One scheduler tick: each active "all"-mode character with an un-answered *human*
 * message is a candidate; we fire at most one proactive reply per channel (so 5
 * characters don't all pile on). Bot/character chatter never makes a candidate, so
 * idle channels stay dormant (hibernation) instead of looping forever.
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
      const hasUnanswered = await db.rp.hasUnansweredHumanTurn(s.spawnId);
      if (hasUnanswered) candidates.push(s);
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
