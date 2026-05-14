import path from 'path';
import Canvas, { type CanvasRenderingContext2D as CanvasCtx } from 'canvas';

// ─── Font Registration ────────────────────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), 'data', 'fonts');

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

const FONT_REGISTRATIONS = [
  { file: 'PlayfairDisplay-Italic.ttf', family: 'Playfair Display', style: 'italic', weight: '400' },
  { file: 'PlayfairDisplay-Italic.ttf', family: 'Playfair Display', style: 'normal', weight: '400' },
  { file: 'Caveat-Regular.ttf', family: 'Caveat', style: 'normal', weight: '400' },
  { file: 'Cinzel-Regular.ttf', family: 'Cinzel', style: 'normal', weight: '400' },
  { file: 'Righteous-Regular.ttf', family: 'Righteous', style: 'normal', weight: '400' },
  { file: 'SpecialElite-Regular.ttf', family: 'Special Elite', style: 'normal', weight: '400' },
  { file: 'Minecraft-Regular.ttf', family: 'Minecraft', style: 'normal', weight: '400' },
  { file: 'HarryP-Regular.ttf', family: 'Harry P', style: 'normal', weight: '400' },
  { file: 'GenshinImpact-Regular.ttf', family: 'Genshin Impact', style: 'normal', weight: '400' },
  { file: 'ComicNeue-Regular.ttf', family: 'Comic Neue', style: 'normal', weight: '400' },
  { file: 'BebasNeue-Regular.ttf', family: 'Bebas Neue', style: 'normal', weight: '400' },
];

FONT_REGISTRATIONS.forEach(({ file, family, style, weight }) => {
  try {
    Canvas.registerFont(path.join(FONTS_DIR, file), { family, style, weight });
    console.log(`Registered font: ${family} (${style})`);
  } catch (e) {
    console.error(`Failed to register font ${family} from ${file}:`, e);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HEX_RE = /^#?([0-9A-Fa-f]{6})$/;

function validateAndNormaliseHex(hex: string): string {
  const match = HEX_RE.exec(hex);
  if (!match) throw new Error(`Invalid hex colour "${hex}"`);
  return `#${match[1]}`;
}

function buildFont(size: number, family: string, forceStyle?: string): string {
  let style = forceStyle || (family === 'Playfair Display' ? 'italic' : 'normal');
  return `${style} ${size}px "${family}"`;
}

function getTwemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

function getDiscordEmojiUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=64&quality=lossless`;
}

const DISCORD_EMOJI_RE = /<(a?):([^:>]+):(\d+)>/g;
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

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const parts: Segment[] = [];
  let lastIndex = 0;
  DISCORD_EMOJI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DISCORD_EMOJI_RE.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    parts.push({ type: 'discord_emoji', id: m[3], animated: m[1] === 'a', url: getDiscordEmojiUrl(m[3], m[1] === 'a') });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });

  parts.forEach((part) => {
    if (part.type !== 'text') { segments.push(part); return; }
    let tLastIndex = 0;
    UNICODE_EMOJI_RE.lastIndex = 0;
    let em: RegExpExecArray | null;
    while ((em = UNICODE_EMOJI_RE.exec(part.value)) !== null) {
      if (em.index > tLastIndex) segments.push({ type: 'text', value: part.value.slice(tLastIndex, em.index) });
      segments.push({ type: 'twemoji', emoji: em[0], url: getTwemojiUrl(em[0]) });
      tLastIndex = em.index + em[0].length;
    }
    if (tLastIndex < part.value.length) segments.push({ type: 'text', value: part.value.slice(tLastIndex) });
  });
  return segments.filter((s) => s.type !== 'text' || s.value.length > 0);
}

function measureSegmentsWidth(ctx: CanvasCtx, lineSegs: Segment[], fontSize: number): number {
  return lineSegs.reduce((w, seg) => (seg.type === 'text' ? w + ctx.measureText(seg.value).width : w + fontSize), 0);
}

function wrapSegments(ctx: CanvasCtx, segments: Segment[], maxWidth: number, fontSize: number): Segment[][] {
  const lines: Segment[][] = [[]];
  const lineIsEmpty = () => lines[lines.length - 1].length === 0;
  const appendText = (lineArr: Segment[], str: string) => {
    const last = lineArr[lineArr.length - 1];
    if (last && last.type === 'text') last.value += str;
    else lineArr.push({ type: 'text', value: str });
  };

  segments.forEach((seg, segIdx) => {
    if (seg.type !== 'text') {
      const current = lines[lines.length - 1];
      const prevSeg = segIdx > 0 ? segments[segIdx - 1] : null;
      if (prevSeg && prevSeg.type !== 'text' && !lineIsEmpty()) appendText(current, ' ');
      const wAfterSpace = measureSegmentsWidth(ctx, current, fontSize);
      if (wAfterSpace + fontSize > maxWidth && !lineIsEmpty()) lines.push([{ ...seg }]);
      else current.push({ ...seg });
      return;
    }
    const raw = seg.value;
    if (raw.trim().length === 0) { if (!lineIsEmpty()) appendText(lines[lines.length - 1], ' '); return; }
    const hasLeadingSpace = raw.startsWith(' ');
    const words = raw.split(' ').filter((word) => word.length > 0);
    words.forEach((word, wordIdx) => {
      const current = lines[lines.length - 1];
      const currentWidth = measureSegmentsWidth(ctx, current, fontSize);
      let prefix = (!lineIsEmpty() && (wordIdx > 0 || hasLeadingSpace)) ? ' ' : '';
      const wordWidth = ctx.measureText(`${prefix}${word}`).width;
      if (currentWidth + wordWidth <= maxWidth || lineIsEmpty()) appendText(current, `${prefix}${word}`);
      else { lines.push([]); appendText(lines[lines.length - 1], word); }
    });
  });
  return lines;
}

function adjustFontSize(ctx: CanvasCtx, lines: Segment[][], maxWidth: number, startSize: number, fontFamily: string, maxHeight: number): number {
  let fontSize = startSize;
  ctx.font = buildFont(fontSize, fontFamily);
  let lineHeight = fontSize * 1.2;
  let totalHeight = lines.length * lineHeight;
  while (fontSize > 10 && (totalHeight > maxHeight || lines.some((line) => measureSegmentsWidth(ctx, line, fontSize) > maxWidth))) {
    fontSize -= 1;
    ctx.font = buildFont(fontSize, fontFamily);
    lineHeight = fontSize * 1.2;
    totalHeight = lines.length * lineHeight;
  }
  return fontSize;
}

async function loadEmojiImages(lines: Segment[][]): Promise<Map<string, any>> {
  const cache = new Map<string, any>();
  const allSegs = lines.flat();
  await Promise.all(
    allSegs.filter((s) => s.type === 'twemoji' || s.type === 'discord_emoji').map(async (s) => {
      const url = (s as any).url;
      if (cache.has(url)) return;
      try {
        cache.set(url, await Canvas.loadImage(url));
      } catch {
        if (s.type === 'discord_emoji' && (s as any).animated) {
          try { cache.set(url, await Canvas.loadImage(`https://cdn.discordapp.com/emojis/${(s as any).id}.png?size=64`)); } catch {}
        }
      }
    }),
  );
  return cache;
}

function drawSegmentedLine(ctx: CanvasCtx, lineSegs: Segment[], centerX: number, y: number, fontSize: number, emojiCache: Map<string, any>, textColor: string): void {
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
      if (img) ctx.drawImage(img, drawX, y + fontSize * 0.05, fontSize, fontSize);
      drawX += fontSize;
    }
  });
}

function fitNickname(ctx: CanvasCtx, nickname: string, maxWidth: number, fontFamily: string, maxFontSize = 36, minFontSize = 12): number {
  let size = maxFontSize;
  ctx.font = buildFont(size, fontFamily, 'normal');
  while (size > minFontSize && ctx.measureText(`- ${nickname}`).width > maxWidth) {
    size -= 1;
    ctx.font = buildFont(size, fontFamily, 'normal');
  }
  return size;
}

// ─── Exported Canvas Functions ────────────────────────────────────────────────

export async function generateQuote(data: {
  username: string,
  nickname: string,
  message: string,
  avatarUrl: string,
  backgroundColor?: string,
  textColor?: string,
  profileColor?: string,
  fontStyle?: string
}): Promise<Buffer> {
  const { username, nickname, message: rawMessage, avatarUrl, backgroundColor: bg = 'black', profileColor: pc = 'normal', fontStyle: fs = 'sans-serif' } = data;
  const message = `"${rawMessage}"`;
  const fontFamily = (FONT_MAP[fs] || FONT_MAP['sans-serif']).family;
  const textColor = data.textColor ? validateAndNormaliseHex(data.textColor) : (bg === 'white' ? 'black' : 'white');

  const canvas = Canvas.createCanvas(1024, 512);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg === 'white' ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, 1024, 512);

  const pfpImage = await Canvas.loadImage(avatarUrl);
  ctx.drawImage(pfpImage, 0, 0, 512, 512);

  if (pc !== 'normal') {
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data: d } = imageData;
    for (let i = 0; i < d.length; i += 4) {
      if (pc === 'bw') { const avg = (d[i] + d[i + 1] + d[i + 2]) / 3; d[i] = avg; d[i+1] = avg; d[i+2] = avg; }
      else if (pc === 'inverted') { d[i] = 255 - d[i]; d[i+1] = 255 - d[i+1]; d[i+2] = 255 - d[i+2]; }
      else if (pc === 'sepia') { const avg = (d[i] + d[i+1] + d[i+2]) / 3; d[i] = Math.min(avg + 100, 255); d[i+1] = Math.min(avg + 50, 255); d[i+2] = avg; }
      else if (pc === 'nightmare') {
        d[i] = 255 - d[i]; d[i+1] = 255 - d[i+1]; d[i+2] = 255 - d[i+2];
        d[i] = Math.min(d[i] + 100, 255); d[i+1] *= 0.5; d[i+2] *= 0.5;
        if (Math.random() < 0.4) {
          d[i] = Math.min(Math.max(d[i] + Math.random() * 120 - 60, 0), 255);
          d[i+1] = Math.min(Math.max(d[i+1] + Math.random() * 120 - 60, 0), 255);
          d[i+2] = Math.min(Math.max(d[i+2] + Math.random() * 120 - 60, 0), 255);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const gradient = ctx.createLinearGradient(384, 0, 512, 0);
  const stopColor = bg === 'white' ? '255, 255, 255' : '0, 0, 0';
  gradient.addColorStop(0, `rgba(${stopColor}, 0)`);
  gradient.addColorStop(1, `rgba(${stopColor}, 1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(384, 0, 128, 512);

  const rawSegments = parseSegments(message);
  let fontSize = 36;
  ctx.font = buildFont(fontSize, fontFamily);
  let lines = wrapSegments(ctx, rawSegments, 480, fontSize);
  fontSize = adjustFontSize(ctx, lines, 480, fontSize, fontFamily, 350);
  ctx.font = buildFont(fontSize, fontFamily);
  lines = wrapSegments(ctx, rawSegments, 480, fontSize);

  const emojiCache = await loadEmojiImages(lines);
  const nickFontSize = fitNickname(ctx, nickname, 480, fontFamily);
  const userFontSize = Math.min(24, Math.max(12, nickFontSize - 6));

  const calcH = (fs: number, ls: Segment[][], nfs: number, ufs: number) => {
    let h = ls.length * fs * 1.2 + 10 + nfs * 1.2;
    if (username !== nickname) h += 8 + ufs * 1.2;
    return h;
  };

  let totalH = calcH(fontSize, lines, nickFontSize, userFontSize);
  while (totalH > 480 && fontSize > 10) {
    fontSize -= 1;
    ctx.font = buildFont(fontSize, fontFamily);
    lines = wrapSegments(ctx, rawSegments, 480, fontSize);
    totalH = calcH(fontSize, lines, nickFontSize, userFontSize);
  }

  const textY = (512 - totalH) / 2;
  const lh = fontSize * 1.2;
  lines.forEach((line, i) => drawSegmentedLine(ctx, line, 768, textY + i * lh, fontSize, emojiCache, textColor));

  const nickY = textY + lines.length * lh + 10;
  ctx.fillStyle = textColor;
  ctx.font = buildFont(nickFontSize, fontFamily, 'normal');
  ctx.textAlign = 'center';
  ctx.fillText(`- ${nickname}`, 768, nickY);

  if (username !== nickname) {
    ctx.fillStyle = '#808080';
    ctx.font = buildFont(userFontSize, fontFamily, 'normal');
    ctx.fillText(`@${username}`, 768, nickY + nickFontSize * 1.2 + 8);
  }

  ctx.fillStyle = '#808080';
  ctx.font = buildFont(18, fontFamily, 'normal');
  ctx.textAlign = 'right';
  ctx.fillText('silverwolf', 1014, 490);

  return canvas.toBuffer();
}

export async function applyEffect(type: string, pfpUrl: string): Promise<Buffer> {
  const canvas = Canvas.createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const img = await Canvas.loadImage(pfpUrl);
  ctx.drawImage(img, 0, 0, 512, 512);

  const imageData = ctx.getImageData(0, 0, 512, 512);
  const { data } = imageData;

  const invert = () => { for (let i = 0; i < data.length; i += 4) { data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2]; } };
  const redTint = (amount = 100, multi = 0.5) => { for (let i = 0; i < data.length; i += 4) { data[i] = Math.min(data[i] + amount, 255); data[i+1] *= multi; data[i+2] *= multi; } };
  const noise = () => { for (let i = 0; i < data.length; i += 4) { if (Math.random() < 0.4) { data[i] = Math.min(Math.max(data[i] + Math.random() * 120 - 60, 0), 255); data[i+1] = Math.min(Math.max(data[i+1] + Math.random() * 120 - 60, 0), 255); data[i+2] = Math.min(Math.max(data[i+2] + Math.random() * 120 - 60, 0), 255); } } };

  if (type === 'shiny' || type === 'horror') invert();
  else if (type === 'nightmare') { invert(); redTint(); noise(); }
  else if (type === 'spooky') redTint();
  else if (type === 'santa') redTint(50, 0.7);

  ctx.putImageData(imageData, 0, 0);

  if (type === 'santa') {
    const snow = await Canvas.loadImage(path.join(process.cwd(), 'data/images/1christmasSnow.png'));
    const deco = await Canvas.loadImage(path.join(process.cwd(), 'data/images/1christmasDeco.png'));
    ctx.drawImage(snow, 0, 0, 512, 512);
    ctx.drawImage(deco, 0, 0, 512, 512);
  }

  return canvas.toBuffer();
}

export async function applyBorder(pfpUrl: string, borderType: 'normal' | 'mystery'): Promise<Buffer> {
  const canvas = Canvas.createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const img = await Canvas.loadImage(pfpUrl);
  ctx.drawImage(img, 0, 0, 512, 512);
  const borderPath = path.join(process.cwd(), `data/images/${borderType === 'mystery' ? '3' : '1'}christmasBorder.png`);
  const border = await Canvas.loadImage(borderPath);
  ctx.drawImage(border, 0, 0, 512, 512);
  return canvas.toBuffer();
}

export async function convertImage(buffer: Buffer, format: string): Promise<Buffer> {
  const image = await Canvas.loadImage(buffer);
  const canvas = Canvas.createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  if (format === 'jpeg') return canvas.toBuffer('image/jpeg', { quality: 0.9 });
  if (format === 'webp') return (canvas as any).toBuffer('image/webp', { quality: 0.9 });
  return canvas.toBuffer();
}
