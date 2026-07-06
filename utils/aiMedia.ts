import type { Message, Attachment } from 'discord.js';
import { logError, logWarning } from './log';

/**
 * Collects image/video/audio attachments from a Discord message (and the
 * message it replies to) into OpenRouter multimodal content parts.
 *
 * Everything is downloaded into memory and sent as base64 data URLs — never
 * written to disk, never stored in history. Base64 is deliberate: Discord CDN
 * URLs are signed and expire (~24h), audio has no URL support at all on
 * OpenRouter, and provider-side URL fetchers are blocked by some hosts.
 * Peak RAM per request is bounded by TOTAL_MEDIA_BYTES (+33% base64 overhead)
 * and the concurrency slot below; buffers are garbage-collected when the
 * generation completes — this is flat data, not a pdfjs-style object graph,
 * so no subprocess is needed (see pdf.ts for the contrast).
 */

const FETCH_TIMEOUT_MS = Number(process.env.DISCORD_FETCH_TIMEOUT_MS) || 15_000;

// Per-request caps. Sizes are checked against Discord's attachment metadata
// BEFORE downloading, so an oversized file never costs a single byte.
const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const MAX_AUDIO = 1;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const TOTAL_MEDIA_BYTES = 30 * 1024 * 1024;

// Only this many messages may hold media buffers at once (download → generate
// → release). Protects the 1g container limit from concurrent video uploads.
const MAX_CONCURRENT_MEDIA = 2;
let activeMediaSlots = 0;

export function tryAcquireMediaSlot(): boolean {
  if (activeMediaSlots >= MAX_CONCURRENT_MEDIA) return false;
  activeMediaSlots += 1;
  return true;
}

export function releaseMediaSlot(): void {
  activeMediaSlots = Math.max(0, activeMediaSlots - 1);
}

export function getActiveMediaSlots(): number {
  return activeMediaSlots;
}

// Whitelists. Image list matches what the Xiaomi endpoint actually accepts
// (its 400 error enumerates bmp/gif/png/jpeg/webp); video/audio lists match
// OpenRouter's documented formats.
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'image/bmp': 'image/bmp',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'video/mp4',
  'video/mpeg': 'video/mpeg',
  'video/webm': 'video/webm',
  'video/quicktime': 'video/mov',
};
// contentType → OpenRouter input_audio `format` value. Discord voice messages
// are audio/ogg (opus) — verified accepted as format "ogg".
const AUDIO_TYPES: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

type MediaKind = 'image' | 'video' | 'audio';

export interface MediaCollectionResult {
  /** OpenRouter content parts (image_url / video_url / input_audio). */
  parts: any[];
  /** Text placeholders for the stored prompt, e.g. "[attached image: cat.png]". */
  placeholders: string[];
  /** User-facing notes about skipped/failed attachments. */
  notices: string[];
}

function classify(att: Attachment): { kind: MediaKind; mime: string } | null {
  const ct = (att.contentType || '').split(';')[0].trim().toLowerCase();
  if (IMAGE_TYPES[ct]) return { kind: 'image', mime: IMAGE_TYPES[ct] };
  if (VIDEO_TYPES[ct]) return { kind: 'video', mime: VIDEO_TYPES[ct] };
  if (AUDIO_TYPES[ct]) return { kind: 'audio', mime: ct };
  return null;
}

function fmtMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

async function downloadAttachment(att: Attachment, cap: number): Promise<Buffer | null> {
  try {
    const res = await fetch(att.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      logWarning(`[aiMedia] download failed (${res.status}) for ${att.name}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Discord metadata said it fit, but never trust that the bytes agree.
    if (buf.byteLength > cap) {
      logWarning(`[aiMedia] ${att.name} exceeded cap after download (${buf.byteLength} > ${cap})`);
      return null;
    }
    return buf;
  } catch (err) {
    logError(`[aiMedia] download error for ${att.name}:`, err);
    return null;
  }
}

/**
 * Gathers media from `message` first, then from the replied-to message (so a
 * "@mi what's in this?" reply to a voice message / image works). Enforces
 * per-type counts, per-file and total byte budgets; everything over a cap is
 * skipped with a notice rather than failing the request.
 */
export async function collectMediaFromMessage(
  message: Message,
  contextMsg: Message | null = null,
): Promise<MediaCollectionResult> {
  const parts: any[] = [];
  const placeholders: string[] = [];
  const notices: string[] = [];

  const counts: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 };
  const maxCounts: Record<MediaKind, number> = { image: MAX_IMAGES, video: MAX_VIDEOS, audio: MAX_AUDIO };
  const byteCaps: Record<MediaKind, number> = {
    image: MAX_IMAGE_BYTES, video: MAX_VIDEO_BYTES, audio: MAX_AUDIO_BYTES,
  };
  let totalBytes = 0;
  const skippedOverCount: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 };
  let skippedUnsupported = 0;

  const candidates: { att: Attachment; kind: MediaKind; mime: string; fromReply: boolean }[] = [];
  const gather = (msg: Message, fromReply: boolean) => {
    for (const att of msg.attachments.values()) {
      const ct = (att.contentType || '').split(';')[0].trim().toLowerCase();
      if (ct === 'application/pdf' || (att.name || '').toLowerCase().endsWith('.pdf')) continue; // pdf.ts owns these
      const cls = classify(att);
      if (!cls) {
        skippedUnsupported += 1;
        continue;
      }
      candidates.push({
        att, kind: cls.kind, mime: cls.mime, fromReply,
      });
    }
  };
  gather(message, false);
  if (contextMsg) gather(contextMsg, true);

  if (candidates.length === 0 && skippedUnsupported === 0) {
    return { parts, placeholders, notices };
  }

  for (const { att, kind, mime } of candidates) {
    if (counts[kind] >= maxCounts[kind]) {
      skippedOverCount[kind] += 1;
      continue;
    }
    const cap = byteCaps[kind];
    if (att.size > cap) {
      notices.push(`⚠ Skipped **${att.name}** — ${kind}s are capped at ${fmtMB(cap)} (yours is ${fmtMB(att.size)}).`);
      continue;
    }
    if (totalBytes + att.size > TOTAL_MEDIA_BYTES) {
      notices.push(`⚠ Skipped **${att.name}** — total media budget of ${fmtMB(TOTAL_MEDIA_BYTES)} per request reached.`);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const buf = await downloadAttachment(att, cap);
    if (!buf) {
      notices.push(`⚠ Couldn't download **${att.name}** — continuing without it.`);
      continue;
    }
    totalBytes += buf.byteLength;
    counts[kind] += 1;

    const b64 = buf.toString('base64');
    if (kind === 'image') {
      parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
    } else if (kind === 'video') {
      parts.push({ type: 'video_url', video_url: { url: `data:${mime};base64,${b64}` } });
    } else {
      parts.push({ type: 'input_audio', input_audio: { data: b64, format: AUDIO_TYPES[mime] || 'mp3' } });
    }
    placeholders.push(`[attached ${kind}: ${att.name || 'file'}]`);
  }

  for (const kind of Object.keys(skippedOverCount) as MediaKind[]) {
    if (skippedOverCount[kind] > 0) {
      notices.push(`⚠ Only the first ${maxCounts[kind]} ${kind}${maxCounts[kind] === 1 ? '' : 's'} per request ${maxCounts[kind] === 1 ? 'is' : 'are'} processed — skipped ${skippedOverCount[kind]} extra.`);
    }
  }
  if (skippedUnsupported > 0 && parts.length === 0 && candidates.length === 0) {
    notices.push('⚠ Attachment type not supported — I can read images (png/jpg/webp/gif/bmp), video (mp4/webm/mov) and audio (ogg/mp3/wav/flac/m4a).');
  }

  return { parts, placeholders, notices };
}
