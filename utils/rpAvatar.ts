import Canvas from 'canvas';
import { log, logError } from './log';

/**
 * Avatar handling for roleplay characters. User-uploaded images are center-cropped
 * and resized to 128×128 PNG, then re-hosted in a per-server asset channel so the
 * webhook has a stable public URL. Discord attachment URLs are signed and expire,
 * so we re-derive a fresh URL from the stored message id (cached ~12h) and fall
 * back to the bot's default avatar when the asset message is gone.
 */

/** ServerConfig key holding the channel id where processed pfps are uploaded. */
export const ASSET_CHANNEL_KEY = 'rp_asset_channel';

const AVATAR_SIZE = 128;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const URL_REFRESH_MS = 12 * 60 * 60 * 1000;

// charId -> last good signed URL + when we fetched it.
const urlCache = new Map<string, { url: string; at: number }>();

/** Size of the avatar-url cache, for /memstats diagnostics. */
export function getAvatarUrlCacheSize(): number {
  return urlCache.size;
}

export type ProcessResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

/**
 * Validates and normalizes an uploaded attachment to a 128×128 PNG buffer.
 * `attachment` is a discord.js Attachment (url/contentType/size).
 */
export async function processAvatar(attachment: {
  url: string; contentType?: string | null; size?: number;
}): Promise<ProcessResult> {
  if (attachment.contentType && !attachment.contentType.startsWith('image/')) {
    return { ok: false, error: 'The pfp must be an image (PNG, JPG, WebP, or GIF).' };
  }
  if (typeof attachment.size === 'number' && attachment.size > MAX_INPUT_BYTES) {
    return { ok: false, error: 'That image is too large — keep it under 8 MB.' };
  }

  let buffer: Buffer;
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) return { ok: false, error: 'Could not download the image. Try re-uploading.' };
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_INPUT_BYTES) {
      return { ok: false, error: 'That image is too large — keep it under 8 MB.' };
    }
    buffer = Buffer.from(bytes);
  } catch (err) {
    logError('Rp: failed to download avatar:', err);
    return { ok: false, error: 'Could not download the image. Try re-uploading.' };
  }

  try {
    const image = await Canvas.loadImage(buffer);
    const side = Math.min(image.width, image.height);
    const sx = Math.floor((image.width - side) / 2);
    const sy = Math.floor((image.height - side) / 2);

    const canvas = Canvas.createCanvas(AVATAR_SIZE, AVATAR_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return { ok: true, buffer: canvas.toBuffer('image/png') };
  } catch (err) {
    logError('Rp: failed to process avatar image:', err);
    return { ok: false, error: 'That image couldn\'t be processed. Try a standard PNG or JPG.' };
  }
}

export type HostResult =
  | { ok: true; url: string; messageId: string; channelId: string }
  | { ok: false; error: string };

/**
 * Uploads the processed pfp to the guild's configured asset channel and returns the
 * resulting CDN URL + message id (used later to refresh the signed URL).
 */
export async function hostAvatar(
  client: any,
  db: any,
  guildId: string,
  charId: string,
  buffer: Buffer,
): Promise<HostResult> {
  const channelId = await db.serverConfig.getServerConfig(guildId, ASSET_CHANNEL_KEY);
  if (!channelId) {
    return {
      ok: false,
      error: 'No roleplay asset channel is configured for this server. An admin must run `/ai rp-setasset` first.',
    };
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof channel.send !== 'function') {
      return { ok: false, error: 'The configured asset channel is invalid. Ask an admin to re-run `/ai rp-setasset`.' };
    }
    const sent = await channel.send({
      content: `pfp:${charId}`,
      files: [{ attachment: buffer, name: `${charId}.png` }],
    });
    const url = [...(sent.attachments?.values() ?? [])][0]?.url;
    if (!url) return { ok: false, error: 'Upload failed — no attachment URL returned.' };
    urlCache.set(charId, { url, at: Date.now() });
    return {
      ok: true, url, messageId: sent.id, channelId,
    };
  } catch (err) {
    logError('Rp: failed to host avatar:', err);
    return { ok: false, error: 'Could not upload to the asset channel. Check the bot\'s permissions there.' };
  }
}

/** Re-fetches the asset message to obtain a fresh signed attachment URL, or null. */
async function refreshAvatarUrl(client: any, channelId: string, messageId: string): Promise<string | null> {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || typeof channel.messages?.fetch !== 'function') return null;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return null;
    return [...(msg.attachments?.values() ?? [])][0]?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a usable avatar URL for webhook delivery, refreshing the signed URL when
 * stale and marking the pfp broken (returns null → caller uses the default avatar)
 * when the asset message has been deleted.
 */
export async function resolveAvatarUrl(client: any, db: any, character: {
  charId: string;
  pfpUrl?: string | null;
  pfpMessageId?: string | null;
  pfpChannelId?: string | null;
}): Promise<string | null> {
  if (!character.pfpMessageId || !character.pfpChannelId) {
    return character.pfpUrl ?? null;
  }
  const cached = urlCache.get(character.charId);
  if (cached && Date.now() - cached.at < URL_REFRESH_MS) return cached.url;

  const fresh = await refreshAvatarUrl(client, character.pfpChannelId, character.pfpMessageId);
  if (fresh) {
    urlCache.set(character.charId, { url: fresh, at: Date.now() });
    db.rp.updateCharacterPfp(character.charId, {
      url: fresh, messageId: character.pfpMessageId, channelId: character.pfpChannelId,
    }).catch(() => {});
    return fresh;
  }

  log(`Rp: avatar for ${character.charId} is broken (asset message gone); falling back to default.`);
  urlCache.delete(character.charId);
  db.rp.clearCharacterPfpUrl(character.charId).catch(() => {});
  return null;
}
