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

/** Splits text into <=2000-char chunks, breaking on whitespace where possible. */
export function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) { chunks.push(remaining); break; }
    let chunk = remaining.slice(0, MAX_LENGTH);
    const breakIndex = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf(' '));
    if (breakIndex > 0) chunk = remaining.slice(0, breakIndex);
    chunks.push(chunk);
    remaining = remaining.slice(chunk.length).trimStart();
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
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (i === 0 && opts.replyToUrl) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel(`↩ Replying to: ${opts.replyToLabel || 'message'}`.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(opts.replyToUrl),
        ));
      }
      // eslint-disable-next-line no-await-in-loop
      await webhook.send({
        content: chunks[i],
        username: character.name,
        avatarURL,
        components,
        allowedMentions: { parse: [] },
      });
    }
    return true;
  } catch (err) {
    logError(`Rp: failed to send as character ${character.charId}:`, err);
    return false;
  }
}
