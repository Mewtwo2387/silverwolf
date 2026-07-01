import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { resolveAvatarUrl } from './rpAvatar';
import { formatCharHandle } from './rpIdentity';

const DETAILS_PREVIEW_CHARS = 1000;
const EMBED_FIELD_MAX = 1024;

/**
 * Shared helpers for the `/ai rp-*` commands: resolving the `char` option (whether
 * the user picked an autocomplete value or typed a name/id), building the searchable
 * autocomplete list (`name · @creator · id`), and rendering a character's detail card.
 */

/** Resolves a `char` option value (a char_id from autocomplete, or a typed name/id). */
export async function resolveCharOption(db: any, value: string | null): Promise<Record<string, any> | null> {
  const v = (value ?? '').trim();
  if (!v) return null;
  const byId = await db.rp.getCharacter(v);
  if (byId) return byId;
  const results = await db.rp.searchCharacters(v);
  if (results.length === 1) return db.rp.getCharacter(results[0].charId);
  const exact = results.filter((r: any) => r.nameLower === v.toLowerCase());
  if (exact.length === 1) return db.rp.getCharacter(exact[0].charId);
  return null;
}

/** Builds up-to-25 autocomplete choices for a character search term. */
export async function buildCharSearchChoices(
  db: any,
  client: any,
  term: string,
): Promise<{ name: string; value: string }[]> {
  const rows = await db.rp.searchCharacters(term || '');
  return rows.slice(0, 25).map((r: any) => {
    const username = client.users.cache.get(r.creatorId)?.username ?? 'unknown';
    const label = `${r.name} · @${username} · ${r.charId}`;
    return { name: label.slice(0, 100), value: r.charId };
  });
}

/** Resolves a creator id to a `@username` label (fetches if not cached). */
export async function resolveCreatorLabel(client: any, creatorId: string): Promise<string> {
  const cached = client.users.cache.get(creatorId);
  if (cached) return `@${cached.username}`;
  try {
    const user = await client.users.fetch(creatorId);
    return `@${user.username}`;
  } catch {
    return '@unknown';
  }
}

/**
 * Renders a character's detail card. Because `details` can now run to thousands of
 * tokens, the embed shows a preview and the full `details` / long `starting_message`
 * ride along as `.txt` attachments. Returns a reply payload ({ embeds, files }).
 */
export async function buildCharacterView(
  client: any,
  db: any,
  character: Record<string, any>,
  creatorLabel: string,
): Promise<{ embeds: EmbedBuilder[]; files: AttachmentBuilder[] }> {
  const freshPfp = await resolveAvatarUrl(client, db, {
    charId: character.charId,
    pfpUrl: character.pfpUrl,
    pfpMessageId: character.pfpMessageId,
    pfpChannelId: character.pfpChannelId,
  });

  const details = character.details || '—';
  const startingMessage = character.startingMessage || '—';
  const files: AttachmentBuilder[] = [];

  const detailsPreview = details.length > DETAILS_PREVIEW_CHARS
    ? `${details.slice(0, DETAILS_PREVIEW_CHARS)}…\n\n*(full details attached as \`details.txt\`)*`
    : details;

  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(character.name)
    .setDescription(detailsPreview)
    .addFields(
      { name: 'ID', value: character.charId, inline: true },
      { name: 'Creator', value: creatorLabel, inline: true },
      { name: 'Mention', value: `\`${formatCharHandle(character.name, character.charId)}\``, inline: true },
    );

  if (details.length > DETAILS_PREVIEW_CHARS) {
    files.push(new AttachmentBuilder(Buffer.from(details, 'utf8'), { name: 'details.txt' }));
  }

  if (startingMessage.length > EMBED_FIELD_MAX) {
    embed.addFields({ name: 'Starting message', value: '*(attached as `starting_message.txt`)*' });
    files.push(new AttachmentBuilder(Buffer.from(startingMessage, 'utf8'), { name: 'starting_message.txt' }));
  } else {
    embed.addFields({ name: 'Starting message', value: startingMessage });
  }

  if (freshPfp) embed.setThumbnail(freshPfp);
  if (!character.pfpMessageId) {
    embed.setFooter({ text: 'No pfp set — using the default avatar.' });
  } else if (!freshPfp) {
    embed.setFooter({ text: 'pfp is broken (asset message gone) — re-upload with /ai rp-edit.' });
  }
  return { embeds: [embed], files };
}
