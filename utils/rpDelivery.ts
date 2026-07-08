import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel,
} from 'discord.js';
import { resolveAvatarUrl } from './rpAvatar';
import { logError } from './log';

/**
 * Delivers a roleplay character's message through the shared AI webhook, overriding
 * the per-message username + avatar so each character appears as itself. Model output
 * is posted with all mentions disabled so a character can never ping anyone.
 */

const WEBHOOK_NAME = process.env.WEBHOOK_NAME || 'grok-webhook';
const MAX_LENGTH = 2000;

// Webhooks can't emit a Discord typing indicator (and the bot's own would show as
// "Silverwolf", breaking character), so we post this as the character and then edit
// it into the reply once the model returns.
export const TYPING_PLACEHOLDER = '*typing.  .  .*';

// Ids of the webhook(s) we post RP output through. A message from one of these whose
// username matches an active character is our own echo — and since only we hold this
// webhook's token, another app that merely reuses a character's name posts through a
// *different* webhook, so it can't be misclassified. The router uses this to skip our
// own posts (incl. the "*typing*" placeholder) out of the "heard" context.
const rpWebhookIds = new Set<string>();
export function isRpWebhookId(id: string | null | undefined): boolean {
  return !!id && rpWebhookIds.has(id);
}

/** Size of the remembered webhook-id set, for /dev ramstats diagnostics. */
export function getRpWebhookIdCount(): number {
  return rpWebhookIds.size;
}

/** The "↩ Replying to" link button, or [] when there's nothing to link. */
function replyButtonRow(
  replyToUrl?: string | null,
  replyToLabel?: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  if (!replyToUrl) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(`↩ Replying to: ${replyToLabel || 'message'}`.slice(0, 80))
      .setStyle(ButtonStyle.Link)
      .setURL(replyToUrl),
  )];
}

/** Splits text into <=2000-char chunks, breaking on whitespace where possible. */
export function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) { chunks.push(remaining); break; }
    let chunk = remaining.slice(0, MAX_LENGTH);
    const breakIndex = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf(' '));
    // Keep the break character with the current chunk and don't trim the remainder,
    // so spaces/newlines at chunk boundaries survive (splitting is lossless).
    if (breakIndex > 0) chunk = remaining.slice(0, breakIndex + 1);
    chunks.push(chunk);
    remaining = remaining.slice(chunk.length);
  }
  return chunks;
}

async function getRpWebhook(channel: TextChannel, client: any): Promise<any | null> {
  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((wh: any) => wh.name === WEBHOOK_NAME && wh.token);
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: WEBHOOK_NAME,
        avatar: client.user?.displayAvatarURL(),
      });
    }
    // Remember this webhook's id so the router can recognise our own output. Recorded
    // before we post through it, so a placeholder's messageCreate can't race ahead.
    if (webhook?.id) rpWebhookIds.add(webhook.id);
    return webhook;
  } catch (err) {
    logError('Rp: failed to get/create webhook (missing Manage Webhooks?):', err);
    return null;
  }
}

export interface CharacterDelivery {
  charId: string;
  name: string;
  pfpUrl?: string | null;
  pfpMessageId?: string | null;
  pfpChannelId?: string | null;
}

/** Posts `text` as the given character. Returns false if delivery was impossible. */
export async function sendAsCharacter(opts: {
  client: any;
  db: any;
  channel: TextChannel;
  character: CharacterDelivery;
  text: string;
  replyToUrl?: string | null;
  replyToLabel?: string | null;
}): Promise<boolean> {
  const {
    client, db, channel, character, text,
  } = opts;
  const webhook = await getRpWebhook(channel, client);
  if (!webhook) return false;

  const avatarURL = (await resolveAvatarUrl(client, db, character))
    ?? client.user?.displayAvatarURL();
  const chunks = splitMessage(text || '…');

  try {
    for (let i = 0; i < chunks.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await webhook.send({
        content: chunks[i],
        username: character.name,
        avatarURL,
        components: i === 0 ? replyButtonRow(opts.replyToUrl, opts.replyToLabel) : [],
        allowedMentions: { parse: [] },
      });
    }
    return true;
  } catch (err) {
    logError(`Rp: failed to send as character ${character.charId}:`, err);
    return false;
  }
}

/** Handles to a posted "typing" placeholder so it can be edited into the reply. */
export interface CharacterTyping {
  webhook: any;
  messageId: string;
  name: string;
  avatarURL: string;
}

/**
 * Posts the character's "typing" placeholder immediately (so the wait reads as the
 * character thinking, not the bot). Returns handles to edit it, or null if delivery
 * is impossible (e.g. missing Manage Webhooks).
 */
export async function postCharacterPlaceholder(opts: {
  client: any;
  db: any;
  channel: TextChannel;
  character: CharacterDelivery;
}): Promise<CharacterTyping | null> {
  const {
    client, db, channel, character,
  } = opts;
  const webhook = await getRpWebhook(channel, client);
  if (!webhook) return null;
  const avatarURL = (await resolveAvatarUrl(client, db, character))
    ?? client.user?.displayAvatarURL();
  try {
    const msg = await webhook.send({
      content: TYPING_PLACEHOLDER,
      username: character.name,
      avatarURL,
      allowedMentions: { parse: [] },
    });
    return {
      webhook, messageId: msg.id, name: character.name, avatarURL,
    };
  } catch (err) {
    logError(`Rp: failed to post typing placeholder for ${character.charId}:`, err);
    return null;
  }
}

/** Edits the placeholder into the reply's first chunk; overflow follows as new messages. */
export async function editCharacterReply(typing: CharacterTyping, opts: {
  text: string;
  replyToUrl?: string | null;
  replyToLabel?: string | null;
}): Promise<boolean> {
  const chunks = splitMessage(opts.text || '…');
  try {
    await typing.webhook.editMessage(typing.messageId, {
      content: chunks[0],
      components: replyButtonRow(opts.replyToUrl, opts.replyToLabel),
      allowedMentions: { parse: [] },
    });
    for (let i = 1; i < chunks.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await typing.webhook.send({
        content: chunks[i],
        username: typing.name,
        avatarURL: typing.avatarURL,
        allowedMentions: { parse: [] },
      });
    }
    return true;
  } catch (err) {
    logError('Rp: failed to edit typing placeholder into reply:', err);
    return false;
  }
}

/** Removes the placeholder (used when generation fails, so no "typing…" is left dangling). */
export async function deleteCharacterPlaceholder(typing: CharacterTyping): Promise<void> {
  try {
    await typing.webhook.deleteMessage(typing.messageId);
  } catch {
    /* already gone / no perms — nothing to do */
  }
}
