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
 * Splits a flat segment array into "lines" (arrays of segments).
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

    if (raw.trim().length === 0) {
      if (!lineIsEmpty()) {
        appendText(lines[lines.length - 1], ' ');
      }
      return;
    }

    const hasLeadingSpace = raw.startsWith(' ');
    const words = raw.split(' ').filter((word) => word.length > 0);

    words.forEach((word, wordIdx) => {
      const current = lines[lines.length - 1];
      const currentWidth = measureSegmentsWidth(ctx, current, fontSize);
      let prefix = '';
      if (!lineIsEmpty()) {
        if (wordIdx > 0 || hasLeadingSpace) prefix = ' ';
      }
      const wordWidth = ctx.measureText(`${prefix}${word}`).width;

      if (currentWidth + wordWidth <= maxWidth || lineIsEmpty()) {
        appendText(current, `${prefix}${word}`);
      } else {
        lines.push([]);
        appendText(lines[lines.length - 1], word);
      }
    });
  });

  return lines;
}

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
    fontSize > 10
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
  emojiCache: Map<string, any>,
  textColor: string,
): void {
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

// ─── Main Quote Function ──────────────────────────────────────────────────────

async function quote(
  guild: Guild,
  _person: User | APIUser,
  _nickname: string | null,
  _message: string,
  _backgroundColor: string | null,
  _textColor: string | null,
  _profileColor: string | null,
  _avatarSource: string | null,
  _fontStyle: string | null,
): Promise<Buffer> {
  const { username } = _person;
  const nickname = _nickname || username;
  const message = `"${_message}"`;
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
  if (avatarSource === 'server') {
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

  if (profileColor === 'bw') {
    ctx.drawImage(pfpImage, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; data[i + 1] = avg; data[i + 2] = avg;
    }
    ctx.putImageData(imageData, 0, 0);
    log('Converted pfp to black and white');
  } else if (profileColor === 'inverted') {
    ctx.drawImage(pfpImage, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
    log('Inverted pfp');
  } else if (profileColor === 'sepia') {
    ctx.drawImage(pfpImage, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
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
    ctx.drawImage(pfpImage, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
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
    ctx.drawImage(pfpImage, 0, 0, 512, 512);
    log('Drew normal pfp');
  }

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
  while (totalHeight > MAX_CONTENT_HEIGHT && fontSize > 10) {
    fontSize -= 1;
    ctx.font = buildFont(fontSize, fontFamily);
    lines = wrapSegments(ctx, rawSegments, MAX_TEXT_WIDTH, fontSize);
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

export default quote;
export { FONT_MAP, FONT_INDEX };
