/*
Credits:
- ChatGPT
- Copilot
- Mystic's Collei bot
*/

import path from 'path';
import Canvas, { type CanvasRenderingContext2D as CanvasCtx } from 'canvas';
import type { APIUser, Guild, User } from 'discord.js';
import { log, logError } from './log';

// ─── Font Registration ────────────────────────────────────────────────────────
const FONTS_DIR = path.join(import.meta.dir, '..', 'data', 'fonts');

const FONT_MAP: Record<string, { family: string }> = {
  'sans-serif': { family: 'sans-serif' },
  playfair: { family: 'Playfair Display' },
  caveat: { family: 'Caveat' },
  cinzel: { family: 'Cinzel' },
  righteous: { family: 'Righteous' },
  'special-elite': { family: 'Special Elite' },
  minecraft: { family: 'Minecraft' },
  harrypotter: { family: 'Harry P' },
  genshin: { family: 'Genshin Impact' },
  'comic-sans': { family: 'Comic Neue' },
  'bebas-neue': { family: 'Bebas Neue' },
};

// Numeric index for mention-based quote parameter parsing (font:1, font:2, etc.)
const FONT_INDEX: string[] = Object.keys(FONT_MAP);

interface FontRegistration {
  file: string;
  family: string;
  style: string;
  weight: string;
}

const FONT_REGISTRATIONS: FontRegistration[] = [
  {
    file: 'PlayfairDisplay-Italic.ttf', family: 'Playfair Display', style: 'italic', weight: '400',
  },
  {
    file: 'PlayfairDisplay-Italic.ttf', family: 'Playfair Display', style: 'normal', weight: '400',
  },
  {
    file: 'Caveat-Regular.ttf', family: 'Caveat', style: 'normal', weight: '400',
  },
  {
    file: 'Cinzel-Regular.ttf', family: 'Cinzel', style: 'normal', weight: '400',
  },
  {
    file: 'Righteous-Regular.ttf', family: 'Righteous', style: 'normal', weight: '400',
  },
  {
    file: 'SpecialElite-Regular.ttf', family: 'Special Elite', style: 'normal', weight: '400',
  },
  {
    file: 'Minecraft-Regular.ttf', family: 'Minecraft', style: 'normal', weight: '400',
  },
  {
    file: 'HarryP-Regular.ttf', family: 'Harry P', style: 'normal', weight: '400',
  },
  {
    file: 'GenshinImpact-Regular.ttf', family: 'Genshin Impact', style: 'normal', weight: '400',
  },
  {
    file: 'ComicNeue-Regular.ttf', family: 'Comic Neue', style: 'normal', weight: '400',
  },
  {
    file: 'BebasNeue-Regular.ttf', family: 'Bebas Neue', style: 'normal', weight: '400',
  },
];

FONT_REGISTRATIONS.forEach(({
  file, family, style, weight,
}) => {
  try {
    Canvas.registerFont(path.join(FONTS_DIR, file), { family, style, weight });
    log(`Registered font: ${family} (${style})`);
  } catch (e) {
    logError(`Failed to register font ${family} from ${file}:`, e);
  }
});

// ─── Hex Colour Validation ────────────────────────────────────────────────────
const HEX_RE = /^#?([0-9A-Fa-f]{6})$/;

function validateAndNormaliseHex(hex: string): string {
  const match = HEX_RE.exec(hex);
  if (!match) {
    throw new Error(`Invalid hex colour "${hex}". Please use a 6-digit hex value like #FF00AA.`);
  }
  return `#${match[1]}`;
}

// ─── Font String Builder ──────────────────────────────────────────────────────
/**
 * Returns a CSS font string for the canvas context.
 * Playfair Display is our italic-only font, so italic is always used for it.
 */
function buildFont(size: number, family: string, forceStyle?: string): string {
  let style: string;
  if (forceStyle) {
    style = forceStyle;
  } else if (family === 'Playfair Display') {
    style = 'italic';
  } else {
    style = 'normal';
  }
  return `${style} ${size}px "${family}"`;
}

// ─── Emoji Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the Twemoji CDN PNG URL for a given emoji string.
 * Strips variation selector U+FE0F before building the codepoint sequence.
 */
function getTwemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

/**
 * Returns the Discord CDN URL for a custom server emoji.
 * Animated emojis use .gif; static use .png.
 */
function getDiscordEmojiUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=64&quality=lossless`;
}

// Matches custom Discord emoji tags: <:name:id> and <a:name:id>
const DISCORD_EMOJI_RE = /<(a?):([^:>]+):(\d+)>/g;

// Matches Discord user, role, and channel mentions
const USER_MENTION_RE = /<@!?(\d+)>/g;
const ROLE_MENTION_RE = /<@&(\d+)>/g;
const CHANNEL_MENTION_RE = /<#(\d+)>/g;

/**
 * Replaces Discord mention tokens (<@id>, <@!id>, <@&id>, <#id>) in `text`
 * with human-readable @name / #name strings, using the provided guild for lookup.
 */
async function resolveMentions(guild: Guild | null, text: string): Promise<string> {
  let out = text;

  const userIds = new Set<string>();
  let m: RegExpExecArray | null;
  USER_MENTION_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = USER_MENTION_RE.exec(text)) !== null) userIds.add(m[1]);

  const userNames = new Map<string, string>();
  for (const id of userIds) {
    let name: string | null = null;
    try {
      if (guild) {
        const member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
        if (member) name = member.nickname || member.user.username;
      }
      if (!name && guild?.client) {
        const user = guild.client.users.cache.get(id) || await guild.client.users.fetch(id).catch(() => null);
        if (user) name = user.username;
      }
    } catch {
      // ignore
    }
    userNames.set(id, name || id);
  }

  out = out.replace(USER_MENTION_RE, (_match, id) => `@${userNames.get(id) || id}`);

  if (guild) {
    out = out.replace(ROLE_MENTION_RE, (_match, id) => {
      const role = guild.roles.cache.get(id);
      return `@${role ? role.name : id}`;
    });
    out = out.replace(CHANNEL_MENTION_RE, (_match, id) => {
      const channel = guild.channels.cache.get(id) as any;
      return `#${channel?.name || id}`;
    });
  }

  return out;
}

// Matches Unicode emoji sequences (presentations, ZWJ, skin tones, flags, keycaps, etc.)
const UNICODE_EMOJI_RE = new RegExp(
  '(\\p{Emoji_Presentation}|\\p{Extended_Pictographic})'
  + '(?:\\uFE0F)?'
  + '(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})(?:\\uFE0F)?)*',
  'gu',
);

type Segment =
  | { type: 'text'; value: string }
  | { type: 'twemoji'; emoji: string; url: string }
  | { type: 'discord_emoji'; id: string; animated: boolean; url: string };

/**
 * Parses a message string into an ordered list of segments.
 */
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];

  // Phase 1: split on Discord custom emoji tags
  const parts: Segment[] = [];
  let lastIndex = 0;
  DISCORD_EMOJI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = DISCORD_EMOJI_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    parts.push({
      type: 'discord_emoji',
      id: m[3],
      animated: m[1] === 'a',
      url: getDiscordEmojiUrl(m[3], m[1] === 'a'),
    });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // Phase 2: within text parts, detect Unicode emojis
  parts.forEach((part) => {
    if (part.type !== 'text') {
      segments.push(part);
      return;
    }
    let tLastIndex = 0;
    UNICODE_EMOJI_RE.lastIndex = 0;
    let em: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((em = UNICODE_EMOJI_RE.exec(part.value)) !== null) {
      if (em.index > tLastIndex) {
        segments.push({ type: 'text', value: part.value.slice(tLastIndex, em.index) });
      }
      segments.push({ type: 'twemoji', emoji: em[0], url: getTwemojiUrl(em[0]) });
      tLastIndex = em.index + em[0].length;
    }
    if (tLastIndex < part.value.length) {
      segments.push({ type: 'text', value: part.value.slice(tLastIndex) });
    }
  });

  return segments.filter((s) => s.type !== 'text' || (s as any).value.length > 0);
}

// ─── Segment Measurement ──────────────────────────────────────────────────────

/**
 * Returns the total pixel width of a line (array of segments).
 * Each emoji segment is treated as a square of size `fontSize`.
 */
function measureSegmentsWidth(ctx: CanvasCtx, lineSegs: Segment[], fontSize: number): number {
  return lineSegs.reduce((w, seg) => {
    if (seg.type === 'text') return w + ctx.measureText(seg.value).width;
    return w + fontSize;
  }, 0);
}

// ─── Segment-Aware Word Wrapping ──────────────────────────────────────────────

/**
 * Splits a word wider than maxWidth into character chunks that each fit.
 * Code-point aware so surrogate pairs are never split in half.
 */
function breakLongWord(ctx: CanvasCtx, word: string, maxWidth: number): string[] {
  const chars = [...word];
  const pieces: string[] = [];
  let start = 0;

  while (start < chars.length) {
    // Binary search for the largest prefix that still fits
    let lo = 1;
    let hi = chars.length - start;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(chars.slice(start, start + mid).join('')).width <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    pieces.push(chars.slice(start, start + lo).join(''));
    start += lo;
  }

  return pieces;
}

/**
 * Splits a flat segment array into "lines" (arrays of segments).
 * `\n` in text segments forces a hard line break; words wider than
 * maxWidth are broken at character level so no line ever overflows.
 */
function wrapSegments(ctx: CanvasCtx, segments: Segment[], maxWidth: number, fontSize: number): Segment[][] {
  const lines: Segment[][] = [[]];

  const lineIsEmpty = () => lines[lines.length - 1].length === 0;

  const appendText = (lineArr: Segment[], str: string) => {
    const last = lineArr[lineArr.length - 1];
    if (last && last.type === 'text') {
      (last as any).value += str;
    } else {
      lineArr.push({ type: 'text', value: str });
    }
  };

  // Appends a word to a fresh line, character-breaking it if it alone
  // exceeds maxWidth.
  const appendWordToLine = (word: string, prefix: string) => {
    if (ctx.measureText(word).width <= maxWidth) {
      appendText(lines[lines.length - 1], `${prefix}${word}`);
      return;
    }
    breakLongWord(ctx, word, maxWidth).forEach((piece, pieceIdx) => {
      if (pieceIdx > 0) lines.push([]);
      appendText(lines[lines.length - 1], pieceIdx === 0 ? `${prefix}${piece}` : piece);
    });
  };

  segments.forEach((seg, segIdx) => {
    if (seg.type !== 'text') {
      const current = lines[lines.length - 1];

      const prevSeg = segIdx > 0 ? segments[segIdx - 1] : null;
      if (prevSeg && prevSeg.type !== 'text' && !lineIsEmpty()) {
        appendText(current, ' ');
      }

      const wAfterSpace = measureSegmentsWidth(ctx, current, fontSize);
      if (wAfterSpace + fontSize > maxWidth && !lineIsEmpty()) {
        lines.push([{ ...seg }]);
      } else {
        current.push({ ...seg });
      }
      return;
    }

    const raw = (seg as any).value as string;
    const chunks = raw.split('\n');

    chunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) lines.push([]); // hard line break

      if (chunk.trim().length === 0) {
        // Whitespace between segments becomes a single separating space,
        // but never at the start of a line.
        if (chunk.length > 0 && !lineIsEmpty()) {
          appendText(lines[lines.length - 1], ' ');
        }
        return;
      }

      const hasLeadingSpace = chunk.startsWith(' ');
      const words = chunk.split(' ').filter((word) => word.length > 0);

      words.forEach((word, wordIdx) => {
        const current = lines[lines.length - 1];
        const currentWidth = measureSegmentsWidth(ctx, current, fontSize);
        let prefix = '';
        if (!lineIsEmpty()) {
          if (wordIdx > 0 || hasLeadingSpace) prefix = ' ';
        }
        const wordWidth = ctx.measureText(`${prefix}${word}`).width;

        if (lineIsEmpty()) {
          appendWordToLine(word, prefix);
        } else if (currentWidth + wordWidth <= maxWidth) {
          appendText(current, `${prefix}${word}`);
        } else {
          lines.push([]);
          appendWordToLine(word, '');
        }
      });
    });
  });

  return lines;
}

// ─── Text Limits ──────────────────────────────────────────────────────────────
// Below MIN_QUOTE_FONT_SIZE the quote is unreadable, so instead of shrinking
// further we truncate with an ellipsis. MAX_QUOTE_CHARS caps the input outright.
const MIN_QUOTE_FONT_SIZE = 14;
const MAX_QUOTE_CHARS = 2000;

// ─── Font Size Shrinking ──────────────────────────────────────────────────────

function anyLineExceedsWidth(ctx: CanvasCtx, lines: Segment[][], fontSize: number, maxWidth: number): boolean {
  return lines.some((line) => measureSegmentsWidth(ctx, line, fontSize) > maxWidth);
}

/**
 * Reduces fontSize until all lines fit within maxWidth and maxHeight.
 */
function adjustFontSize(
  ctx: CanvasCtx,
  lines: Segment[][],
  maxWidth: number,
  _fontSize: number,
  fontFamily: string,
  maxHeight?: number,
): number {
  let fontSize = _fontSize;
  const height = maxHeight !== undefined ? maxHeight : 350;
  ctx.font = buildFont(fontSize, fontFamily);

  let lineHeight = fontSize * 1.2;
  let totalHeight = lines.length * lineHeight;

  while (
    fontSize > MIN_QUOTE_FONT_SIZE
    && (
      totalHeight > height
      || anyLineExceedsWidth(ctx, lines, fontSize, maxWidth)
    )
  ) {
    fontSize -= 1;
    ctx.font = buildFont(fontSize, fontFamily);
    lineHeight = fontSize * 1.2;
    totalHeight = lines.length * lineHeight;
  }

  return fontSize;
}

// ─── Emoji Image Preloader ────────────────────────────────────────────────────

/**
 * Fetches all emoji images referenced by the given lines (segment arrays).
 */
async function loadEmojiImages(lines: Segment[][]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();
  const allSegs = lines.flat();
  await Promise.all(
    allSegs
      .filter((s) => s.type === 'twemoji' || s.type === 'discord_emoji')
      .map(async (s) => {
        const url = (s as any).url as string;
        if (cache.has(url)) return;
        try {
          cache.set(url, await Canvas.loadImage(url));
        } catch {
          if (s.type === 'discord_emoji' && (s as any).animated) {
            const pngUrl = `https://cdn.discordapp.com/emojis/${(s as any).id}.png?size=64`;
            try {
              cache.set(url, await Canvas.loadImage(pngUrl));
            } catch {
              logError(`Failed to load emoji image: ${url}`);
            }
          } else {
            logError(`Failed to load emoji image: ${url}`);
          }
        }
      }),
  );
  return cache;
}

// ─── Segmented Line Renderer ──────────────────────────────────────────────────

/**
 * Draws a single mixed text+emoji line, horizontally centred at `centerX`.
 */
function drawSegmentedLine(
  ctx: CanvasCtx,
  lineSegs: Segment[],
  centerX: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  emojiCache: Map<string, any>,
  textColor: string,
): void {
  // ctx.font may have been changed since the lines were wrapped (e.g. by
  // nickname sizing) — restore it so measurement matches rendering.
  ctx.font = buildFont(fontSize, fontFamily);
  const totalWidth = measureSegmentsWidth(ctx, lineSegs, fontSize);
  let drawX = centerX - totalWidth / 2;

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lineSegs.forEach((seg) => {
    if (seg.type === 'text') {
      ctx.fillText(seg.value, drawX, y);
      drawX += ctx.measureText(seg.value).width;
    } else {
      const img = emojiCache.get((seg as any).url);
      if (img) {
        ctx.drawImage(img, drawX, y + fontSize * 0.05, fontSize, fontSize);
      }
      drawX += fontSize;
    }
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
}

// ─── Nickname Font Sizing ─────────────────────────────────────────────────────

/**
 * Returns the largest font size ≤ maxFontSize at which `- ${nickname}`
 * fits within maxWidth.
 */
function fitNickname(
  ctx: CanvasCtx,
  nickname: string,
  maxWidth: number,
  fontFamily: string,
  maxFontSize?: number,
  minFontSize?: number,
): number {
  const max = maxFontSize !== undefined ? maxFontSize : 36;
  const min = minFontSize !== undefined ? minFontSize : 12;
  let size = max;
  ctx.font = buildFont(size, fontFamily, 'normal');
  while (size > min && ctx.measureText(`- ${nickname}`).width > maxWidth) {
    size -= 1;
    ctx.font = buildFont(size, fontFamily, 'normal');
  }
  return size;
}

// ─── Avatar Drawing ───────────────────────────────────────────────────────────

/**
 * Draws the avatar at (0, 0) scaled to w×h and applies the requested
 * profileColor filter in place.
 */
function drawFilteredAvatar(ctx: CanvasCtx, pfpImage: any, w: number, h: number, profileColor: string): void {
  ctx.drawImage(pfpImage, 0, 0, w, h);
  if (profileColor === 'bw') {
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
    }
    ctx.putImageData(imageData, 0, 0);
    log('Converted pfp to black and white');
  } else if (profileColor === 'inverted') {
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
    log('Inverted pfp');
  } else if (profileColor === 'sepia') {
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = Math.min(avg + 100, 255);
      data[i + 1] = Math.min(avg + 50, 255);
      data[i + 2] = avg;
    }
    ctx.putImageData(imageData, 0, 0);
    log('Drew sepia pfp');
  } else if (profileColor === 'nightmare') {
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(data[i] + 100, 255);
      data[i + 1] = data[i + 1] * 0.5;
      data[i + 2] = data[i + 2] * 0.5;
      if (Math.random() < 0.4) {
        const noiseR = Math.floor(Math.random() * 120) - 60;
        const noiseG = Math.floor(Math.random() * 120) - 60;
        const noiseB = Math.floor(Math.random() * 120) - 60;
        data[i] = Math.min(Math.max(data[i] + noiseR, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + noiseG, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + noiseB, 0), 255);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    log('Applied nightmare effect to pfp');
  } else {
    log('Drew normal pfp');
  }
}

// ─── Ellipsis Truncation ──────────────────────────────────────────────────────

/**
 * Keeps at most maxLines lines and ends the last kept line with `suffix`
 * (default …"), trimming its tail until it fits maxWidth again.
 * ctx.font must already be set to the rendering font.
 */
function truncateWithEllipsis(
  ctx: CanvasCtx,
  _lines: Segment[][],
  maxLines: number,
  fontSize: number,
  maxWidth: number,
  suffix = '…"',
): Segment[][] {
  const lines = _lines.slice(0, Math.max(1, maxLines));
  const lastLine = lines[lines.length - 1];
  const lastSeg = lastLine[lastLine.length - 1];
  if (lastSeg && lastSeg.type === 'text') {
    lastSeg.value = `${lastSeg.value.replace(/["\s]+$/, '')}${suffix}`;
  } else {
    lastLine.push({ type: 'text', value: suffix });
  }

  // Trim the tail until the ellipsised line fits the width again
  while (measureSegmentsWidth(ctx, lastLine, fontSize) > maxWidth) {
    const tail = lastLine[lastLine.length - 1] as { type: 'text'; value: string };
    const chars = [...tail.value];
    if (chars.length > suffix.length) {
      chars.splice(chars.length - suffix.length - 1, 1); // remove the char before the suffix
      tail.value = chars.join('');
    } else if (lastLine.length > 1) {
      lastLine.splice(lastLine.length - 2, 1); // drop the emoji before the tail
    } else {
      break;
    }
  }

  log('Truncated quote text with ellipsis');
  return lines;
}

// ─── Avatar URL Resolution ────────────────────────────────────────────────────

function resolveAvatarUrl(person: User | APIUser): string {
  if (typeof (person as User).displayAvatarURL === 'function') {
    return (person as User).displayAvatarURL({ extension: 'png', size: 512 });
  }
  if (person.avatar) {
    return `https://cdn.discordapp.com/avatars/${person.id}/${person.avatar}.png?size=512`;
  }
  // eslint-disable-next-line no-bitwise, node/no-unsupported-features/es-builtins
  const defaultIndex = (BigInt(person.id) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

// ─── Vertical (Portrait) Renderer ─────────────────────────────────────────────

interface VerticalQuoteInput {
  message: string; // sanitized + clipped, WITHOUT surrounding quote marks
  nickname: string;
  username: string;
  backgroundColor: string;
  textColor: string;
  profileColor: string;
  pfp: string;
  fontFamily: string;
}

/**
 * Portrait layout: avatar on top fading into the background colour, big
 * quotation-mark glyph, centred quote text, divider, name and @username.
 */
async function renderVerticalQuote(input: VerticalQuoteInput): Promise<Buffer> {
  const {
    message, nickname, username, backgroundColor, textColor, profileColor, pfp, fontFamily,
  } = input;

  const WIDTH = 640;
  const HEIGHT = 800;
  const AVATAR_SIZE = 640; // full-width square at the top
  const MAX_TEXT_WIDTH = 560;
  const MAX_TEXT_HEIGHT = 250;
  const CONTENT_BOTTOM = 760; // baseline the content block sits above

  const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  log('Created vertical canvas');

  const bgHex = backgroundColor === 'white' ? '#ffffff' : '#000000';
  const bgRgb = backgroundColor === 'white' ? '255, 255, 255' : '0, 0, 0';
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const pfpImage = await Canvas.loadImage(pfp);
  drawFilteredAvatar(ctx, pfpImage, AVATAR_SIZE, AVATAR_SIZE, profileColor);

  // ── Wrap, shrink, truncate ────────────────────────────────────────────────
  let fontSize = 32;
  const rawSegments = parseSegments(message);

  ctx.font = buildFont(fontSize, fontFamily);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);
  fontSize = adjustFontSize(ctx, lines, MAX_TEXT_WIDTH, fontSize, fontFamily, MAX_TEXT_HEIGHT);
  ctx.font = buildFont(fontSize, fontFamily);
  lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);

  const lineHeight = fontSize * 1.2;
  const maxLines = Math.max(1, Math.floor(MAX_TEXT_HEIGHT / lineHeight));
  if (lines.length > maxLines) {
    lines = truncateWithEllipsis(ctx, lines, maxLines, fontSize, MAX_TEXT_WIDTH, '…');
  }

  const emojiCache = await loadEmojiImages(lines);
  log('Loaded emoji images');

  // ── Content block layout (bottom-anchored) ────────────────────────────────
  const nickFontSize = fitNickname(ctx, nickname, MAX_TEXT_WIDTH, fontFamily, 32);
  const userFontSize = Math.min(20, Math.max(12, nickFontSize - 10));
  const showUser = username !== nickname;

  const glyphSize = 56;
  const gapAfterGlyph = 14;
  const textHeight = lines.length * lineHeight;
  const gapAfterText = 26;
  const gapAfterDivider = 18;
  const nickHeight = nickFontSize * 1.2;
  const userHeight = showUser ? userFontSize * 1.3 + 4 : 0;

  const totalHeight = glyphSize + gapAfterGlyph + textHeight
    + gapAfterText + gapAfterDivider + nickHeight + userHeight;
  let y = CONTENT_BOTTOM - totalHeight;
  const centerX = WIDTH / 2;

  // ── Gradient fade (avatar → content) ──────────────────────────────────────
  // Anchored to wherever the content block starts so the text always sits on
  // an opaque background, however tall the quote is.
  const fadeBottom = Math.min(AVATAR_SIZE, y + 50);
  const fadeTop = Math.max(0, fadeBottom - 320);
  const gradient = ctx.createLinearGradient(0, fadeTop, 0, fadeBottom);
  gradient.addColorStop(0, `rgba(${bgRgb}, 0)`);
  gradient.addColorStop(0.5, `rgba(${bgRgb}, 0.55)`);
  gradient.addColorStop(0.8, `rgba(${bgRgb}, 0.9)`);
  gradient.addColorStop(1, `rgba(${bgRgb}, 1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, fadeTop, WIDTH, fadeBottom - fadeTop);
  if (fadeBottom < AVATAR_SIZE) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, fadeBottom, WIDTH, AVATAR_SIZE - fadeBottom);
  }
  log('Filled vertical gradient');

  // Quotation-mark glyph
  ctx.fillStyle = textColor;
  ctx.font = `bold ${glyphSize}px "${fontFamily}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('“”', centerX, y);
  y += glyphSize + gapAfterGlyph;

  // Quote text
  lines.forEach((lineSegs, index) => {
    drawSegmentedLine(ctx, lineSegs, centerX, y + index * lineHeight, fontSize, fontFamily, emojiCache, textColor);
  });
  y += textHeight + gapAfterText;
  log('Drew vertical quote');

  // Divider
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 90, y);
  ctx.lineTo(centerX + 90, y);
  ctx.stroke();
  y += gapAfterDivider;

  // Name + @username
  ctx.fillStyle = textColor;
  ctx.font = buildFont(nickFontSize, fontFamily, 'normal');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(nickname, centerX, y);
  y += nickHeight + 4;
  if (showUser) {
    ctx.fillStyle = '#808080';
    ctx.font = buildFont(userFontSize, fontFamily, 'normal');
    ctx.fillText(`@${username}`, centerX, y);
  }
  log('Drew vertical nickname');

  // Footer watermark
  ctx.fillStyle = '#808080';
  ctx.font = buildFont(16, fontFamily, 'normal');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('silverwolf', WIDTH - 12, HEIGHT - 10);

  return canvas.toBuffer();
}

// ─── Main Quote Function ──────────────────────────────────────────────────────

async function quote(
  guild: Guild | null,
  _person: User | APIUser,
  _nickname: string | null,
  _message: string,
  _backgroundColor: string | null,
  _textColor: string | null,
  _profileColor: string | null,
  _avatarSource: string | null,
  _fontStyle: string | null,
  _format: string | null = null,
): Promise<Buffer> {
  const { username } = _person;
  const nickname = _nickname || username;
  const resolvedMessage = (await resolveMentions(guild, _message))
    .replace(/\r\n?/g, '\n') // normalise CRLF / lone CR to \n
    .replace(/\t/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  const messageChars = [...resolvedMessage];
  const clippedMessage = messageChars.length > MAX_QUOTE_CHARS
    ? `${messageChars.slice(0, MAX_QUOTE_CHARS).join('').trimEnd()}…`
    : resolvedMessage;
  const message = `"${clippedMessage}"`;
  const backgroundColor = _backgroundColor || 'black';
  const profileColor = _profileColor || 'normal';
  const avatarSource = _avatarSource || 'global';
  const fontStyle = _fontStyle || 'sans-serif';

  // Resolve font family
  const fontFamily = (FONT_MAP[fontStyle] || FONT_MAP['sans-serif']).family;

  // Validate and resolve text colour
  let textColor: string;
  if (_textColor) {
    textColor = validateAndNormaliseHex(_textColor);
  } else {
    textColor = backgroundColor === 'white' ? 'black' : 'white';
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  let pfp: string;
  if (avatarSource === 'server' && guild) {
    try {
      const member = guild.members.cache.get(_person.id);
      if (member && member.avatar) {
        pfp = member.displayAvatarURL({ extension: 'png', size: 512 });
      } else {
        throw new Error('Server avatar not found, falling back to global avatar.');
      }
    } catch (error) {
      logError('Failed to fetch server avatar:', error);
      pfp = resolveAvatarUrl(_person);
    }
  } else {
    pfp = resolveAvatarUrl(_person);
  }

  // ── Vertical (portrait) format ────────────────────────────────────────────
  if (_format === 'vertical') {
    return renderVerticalQuote({
      message: clippedMessage,
      nickname,
      username,
      backgroundColor,
      textColor,
      profileColor,
      pfp,
      fontFamily,
    });
  }

  // ── Canvas Setup ──────────────────────────────────────────────────────────
  const canvas = Canvas.createCanvas(1024, 512);
  const ctx = canvas.getContext('2d');
  log('Created canvas');

  // Background
  ctx.fillStyle = backgroundColor === 'white' ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, 1024, 512);
  log(`Filled ${backgroundColor} background`);

  // ── Profile Picture ───────────────────────────────────────────────────────
  const pfpImage = await Canvas.loadImage(pfp);
  drawFilteredAvatar(ctx, pfpImage, 512, 512, profileColor);

  // ── Gradient Fade (pfp → text area) ──────────────────────────────────────
  const gradient = ctx.createLinearGradient(384, 0, 512, 0);
  if (backgroundColor === 'white') {
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
  } else {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(384, 0, 128, 512);
  log('Filled gradient');

  // ── Layout Constants ──────────────────────────────────────────────────────
  const TEXT_CENTER_X = 768;
  const MAX_TEXT_WIDTH = 480;
  const MAX_CONTENT_HEIGHT = 480;
  let fontSize = 36;

  // ── Parse message into segments, wrap and size-adjust ────────────────────
  const rawSegments = parseSegments(message);

  ctx.font = buildFont(fontSize, fontFamily);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);
  fontSize = adjustFontSize(ctx, lines, MAX_TEXT_WIDTH, fontSize, fontFamily, 350);

  // Re-wrap at the final font size so line breaks are accurate
  ctx.font = buildFont(fontSize, fontFamily);
  lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);

  // Preload emoji images used across all lines
  const emojiCache = await loadEmojiImages(lines);
  log('Loaded emoji images');

  // ── Name / username sizing ────────────────────────────────────────────────
  const nickFontSize = fitNickname(ctx, nickname, MAX_TEXT_WIDTH, fontFamily);
  const userFontSize = Math.min(24, Math.max(12, nickFontSize - 6));

  // ── Height calculation ────────────────────────────────────────────────────
  const calcTotalHeight = (fs: number, wrappedLines: Segment[][], nfs: number, ufs: number): number => {
    const lh = fs * 1.2;
    const textH = wrappedLines.length * lh;
    const nickMargin = 10;
    const userMargin = 8;
    const nickH = nfs * 1.2;
    const userH = ufs * 1.2;
    let h = textH + nickMargin + nickH;
    if (username !== nickname) h += userMargin + userH;
    return h;
  };

  let totalHeight = calcTotalHeight(fontSize, lines, nickFontSize, userFontSize);

  // If still overflowing, shrink quote font further and re-wrap
  while (totalHeight > MAX_CONTENT_HEIGHT && fontSize > MIN_QUOTE_FONT_SIZE) {
    fontSize -= 1;
    ctx.font = buildFont(fontSize, fontFamily);
    lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);
    totalHeight = calcTotalHeight(fontSize, lines, nickFontSize, userFontSize);
  }

  // ── Ellipsis truncation ───────────────────────────────────────────────────
  // Even at the minimum font the text doesn't fit (e.g. newline spam): drop
  // trailing lines and end the last kept line with …" instead of squeezing
  // the name off the canvas.
  if (totalHeight > MAX_CONTENT_HEIGHT) {
    ctx.font = buildFont(fontSize, fontFamily);
    const lh = fontSize * 1.2;
    const reservedHeight = totalHeight - lines.length * lh; // nickname/username block
    const maxLines = Math.max(1, Math.floor((MAX_CONTENT_HEIGHT - reservedHeight) / lh));
    lines = truncateWithEllipsis(ctx, lines, maxLines, fontSize, MAX_TEXT_WIDTH);
    totalHeight = calcTotalHeight(fontSize, lines, nickFontSize, userFontSize);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  const textY = (canvas.height - totalHeight) / 2;
  const lineHeight = fontSize * 1.2;

  // Quote text lines
  lines.forEach((lineSegs, index) => {
    drawSegmentedLine(
      ctx,
      lineSegs,
      TEXT_CENTER_X,
      textY + index * lineHeight,
      fontSize,
      fontFamily,
      emojiCache,
      textColor,
    );
  });
  log('Drew quote');

  // Nickname (- Name)
  const nickY = textY + lines.length * lineHeight + 10;
  ctx.fillStyle = textColor;
  ctx.font = buildFont(nickFontSize, fontFamily, 'normal');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`- ${nickname}`, TEXT_CENTER_X, nickY);
  log('Drew nickname');

  // @username (if different from nickname)
  if (username !== nickname) {
    const userY = nickY + nickFontSize * 1.2 + 8;
    ctx.fillStyle = '#808080';
    ctx.font = buildFont(userFontSize, fontFamily, 'normal');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`@${username}`, TEXT_CENTER_X, userY);
    log('Drew username');
  }

  // Footer watermark
  ctx.fillStyle = '#808080';
  ctx.font = buildFont(18, fontFamily, 'normal');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('silverwolf', 1014, 502);

  return canvas.toBuffer();
}

// ─── Shared option lists for the fakequote command + web page ────────────────

export interface FakeQuoteOption { value: string; label: string }

// Source of truth for the font picker; order matches what the Discord slash
// command displays. The web page builds <select> options from this list, and
// `bot-bridge.ts` validates incoming `fontStyle` values against it.
export const FAKEQUOTE_FONTS: FakeQuoteOption[] = [
  { value: 'sans-serif', label: 'Default (Sans-serif)' },
  { value: 'playfair', label: 'Playfair Display (Elegant Serif)' },
  { value: 'caveat', label: 'Caveat (Handwritten)' },
  { value: 'cinzel', label: 'Cinzel (Dramatic Classic)' },
  { value: 'righteous', label: 'Righteous (Bold Display)' },
  { value: 'special-elite', label: 'Special Elite (Typewriter)' },
  { value: 'minecraft', label: 'Minecraft (Pixel)' },
  { value: 'harrypotter', label: 'Harry Potter (Wizarding)' },
  { value: 'genshin', label: 'Genshin Impact' },
  { value: 'comic-sans', label: 'Comic Sans (Comic Neue)' },
  { value: 'bebas-neue', label: 'Bebas Neue (Condensed)' },
];

export const FAKEQUOTE_FORMATS: FakeQuoteOption[] = [
  { value: 'landscape', label: 'Landscape (Classic)' },
  { value: 'vertical', label: 'Vertical (Portrait)' },
];

export const FAKEQUOTE_BACKGROUNDS: FakeQuoteOption[] = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
];

export const FAKEQUOTE_PROFILE_COLORS: FakeQuoteOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'bw', label: 'Black and White' },
  { value: 'inverted', label: 'Inverted' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'nightmare', label: 'Nightmare Fuel' },
];

export const FAKEQUOTE_AVATAR_SOURCES: FakeQuoteOption[] = [
  { value: 'server', label: 'Server Avatar' },
  { value: 'global', label: 'Global Avatar' },
];

const valuesOf = (opts: FakeQuoteOption[]) => opts.map((o) => o.value);

export const FAKEQUOTE_FONT_VALUES = valuesOf(FAKEQUOTE_FONTS);
export const FAKEQUOTE_FORMAT_VALUES = valuesOf(FAKEQUOTE_FORMATS);
export const FAKEQUOTE_BACKGROUND_VALUES = valuesOf(FAKEQUOTE_BACKGROUNDS);
export const FAKEQUOTE_PROFILE_COLOR_VALUES = valuesOf(FAKEQUOTE_PROFILE_COLORS);
export const FAKEQUOTE_AVATAR_SOURCE_VALUES = valuesOf(FAKEQUOTE_AVATAR_SOURCES);

// Discord slash-command `choices` shape ({ name, value }).
export const fakeQuoteChoices = (
  opts: FakeQuoteOption[],
): { name: string; value: string }[] => opts.map(({ label, value }) => ({ name: label, value }));

export default quote;
export { FONT_MAP, FONT_INDEX };
