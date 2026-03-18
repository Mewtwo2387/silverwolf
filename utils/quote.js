/*
Credits:
- ChatGPT
- Copilot
- Mystic's Collei bot
*/

const path = require('path');
const Canvas = require('canvas');
const { log, logError } = require('./log');

// ─── Font Registration ────────────────────────────────────────────────────────
const FONTS_DIR = path.join(__dirname, '..', 'data', 'fonts');

const FONT_MAP = {
  'sans-serif': { family: 'sans-serif' },
  playfair: { family: 'Playfair Display' },
  caveat: { family: 'Caveat' },
  cinzel: { family: 'Cinzel' },
  righteous: { family: 'Righteous' },
  'special-elite': { family: 'Special Elite' },
};

try {
  Canvas.registerFont(path.join(FONTS_DIR, 'PlayfairDisplay-Italic.ttf'), { family: 'Playfair Display', style: 'italic', weight: '400' });
  Canvas.registerFont(path.join(FONTS_DIR, 'PlayfairDisplay-Italic.ttf'), { family: 'Playfair Display', style: 'normal', weight: '400' });
  Canvas.registerFont(path.join(FONTS_DIR, 'Caveat-Regular.ttf'), { family: 'Caveat', style: 'normal', weight: '400' });
  Canvas.registerFont(path.join(FONTS_DIR, 'Cinzel-Regular.ttf'), { family: 'Cinzel', style: 'normal', weight: '400' });
  Canvas.registerFont(path.join(FONTS_DIR, 'Righteous-Regular.ttf'), { family: 'Righteous', style: 'normal', weight: '400' });
  Canvas.registerFont(path.join(FONTS_DIR, 'SpecialElite-Regular.ttf'), { family: 'Special Elite', style: 'normal', weight: '400' });
  log('Custom fonts registered');
} catch (e) {
  logError('Failed to register custom fonts:', e);
}

// ─── Hex Colour Validation ────────────────────────────────────────────────────
const HEX_RE = /^#?([0-9A-Fa-f]{6})$/;

function validateAndNormaliseHex(hex) {
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
function buildFont(size, family, forceStyle) {
  let style;
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
function getTwemojiUrl(emoji) {
  const codepoints = [...emoji]
    .map((c) => c.codePointAt(0).toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

/**
 * Returns the Discord CDN URL for a custom server emoji.
 * Animated emojis use .gif; static use .png.
 */
function getDiscordEmojiUrl(id, animated) {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=64&quality=lossless`;
}

// Matches custom Discord emoji tags: <:name:id> and <a:name:id>
const DISCORD_EMOJI_RE = /<(a?):([^:>]+):(\d+)>/g;

// Matches Unicode emoji sequences (presentations, ZWJ, skin tones, flags, keycaps, etc.)
const UNICODE_EMOJI_RE = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?)*/gu;

/**
 * Parses a message string into an ordered list of segments:
 *   { type: 'text', value: '...' }
 *   { type: 'twemoji', emoji: '😀', url: '...' }
 *   { type: 'discord_emoji', id: '...', animated: boolean, url: '...' }
 */
function parseSegments(text) {
  const segments = [];

  // Phase 1: split on Discord custom emoji tags
  const parts = [];
  let lastIndex = 0;
  DISCORD_EMOJI_RE.lastIndex = 0;
  let m;
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
  for (const part of parts) {
    if (part.type !== 'text') {
      segments.push(part);
    } else {
      let tLastIndex = 0;
      UNICODE_EMOJI_RE.lastIndex = 0;
      let em;
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
    }
  }

  return segments.filter((s) => s.type !== 'text' || s.value.length > 0);
}

// ─── Segment Measurement ──────────────────────────────────────────────────────

/**
 * Returns the total pixel width of a line (array of segments).
 * Each emoji segment is treated as a square of size `fontSize`.
 */
function measureSegmentsWidth(ctx, lineSegs, fontSize) {
  return lineSegs.reduce((w, seg) => {
    if (seg.type === 'text') return w + ctx.measureText(seg.value).width;
    return w + fontSize;
  }, 0);
}

// ─── Segment-Aware Word Wrapping ──────────────────────────────────────────────

/**
 * Splits a flat segment array into "lines" (arrays of segments).
 * Wraps at word boundaries within text segments, treating each emoji as one word.
 *
 * A space prefix is added before a word only when the current line already
 * has content — this avoids the i===0 edge case with mixed emoji/text segments.
 */
function wrapSegments(ctx, segments, maxWidth, fontSize) {
  const lines = [[]];

  // Returns true if the current (last) line has any content
  const lineIsEmpty = () => lines[lines.length - 1].length === 0;

  // Appends text to the last text segment on the line, or pushes a new one
  const appendText = (lineArr, str) => {
    const last = lineArr[lineArr.length - 1];
    if (last && last.type === 'text') {
      last.value += str;
    } else {
      lineArr.push({ type: 'text', value: str });
    }
  };

  for (const seg of segments) {
    if (seg.type !== 'text') {
      // Emoji: place on current line if it fits, else new line
      const current = lines[lines.length - 1];
      const w = measureSegmentsWidth(ctx, current, fontSize);
      if (w + fontSize > maxWidth && !lineIsEmpty()) {
        lines.push([{ ...seg }]);
      } else {
        current.push({ ...seg });
      }
      continue;
    }

    // Text: split into words (filter out empties from double-spaces etc.)
    const words = seg.value.split(' ').filter((w) => w.length > 0);
    for (const word of words) {
      const current = lines[lines.length - 1];
      const w = measureSegmentsWidth(ctx, current, fontSize);
      const prefix = lineIsEmpty() ? '' : ' ';
      const wordWidth = ctx.measureText(`${prefix}${word}`).width;

      if (w + wordWidth <= maxWidth || lineIsEmpty()) {
        appendText(current, `${prefix}${word}`);
      } else {
        // Word doesn't fit — start a new line
        lines.push([]);
        appendText(lines[lines.length - 1], word);
      }
    }
  }

  return lines;
}

// ─── Font Size Shrinking ──────────────────────────────────────────────────────

/**
 * Reduces fontSize until all lines fit within maxWidth and maxHeight.
 * Returns the new (possibly reduced) fontSize.
 */
function adjustFontSize(ctx, lines, maxWidth, _fontSize, fontFamily, maxHeight) {
  let fontSize = _fontSize;
  const height = maxHeight !== undefined ? maxHeight : 350;
  ctx.font = buildFont(fontSize, fontFamily);

  let lineHeight = fontSize * 1.2;
  let totalHeight = lines.length * lineHeight;

  while (
    fontSize > 10
    && (
      totalHeight > height
      || lines.some((line) => measureSegmentsWidth(ctx, line, fontSize) > maxWidth)
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
 * Returns a Map from URL → Canvas Image.
 * Attempts a .png fallback for animated Discord emoji GIFs that fail to load.
 */
async function loadEmojiImages(lines) {
  const cache = new Map();
  const allSegs = lines.flat();
  await Promise.all(
    allSegs
      .filter((s) => s.type === 'twemoji' || s.type === 'discord_emoji')
      .map(async (s) => {
        if (cache.has(s.url)) return;
        try {
          cache.set(s.url, await Canvas.loadImage(s.url));
        } catch {
          if (s.type === 'discord_emoji' && s.animated) {
            const pngUrl = `https://cdn.discordapp.com/emojis/${s.id}.png?size=64`;
            try {
              cache.set(s.url, await Canvas.loadImage(pngUrl));
            } catch {
              logError(`Failed to load emoji image: ${s.url}`);
            }
          } else {
            logError(`Failed to load emoji image: ${s.url}`);
          }
        }
      }),
  );
  return cache;
}

// ─── Segmented Line Renderer ──────────────────────────────────────────────────

/**
 * Draws a single mixed text+emoji line, horizontally centred at `centerX`.
 * Temporarily switches ctx to left-aligned for per-segment drawing.
 */
function drawSegmentedLine(ctx, lineSegs, centerX, y, fontSize, emojiCache, textColor) {
  const totalWidth = measureSegmentsWidth(ctx, lineSegs, fontSize);
  let drawX = centerX - totalWidth / 2;

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (const seg of lineSegs) {
    if (seg.type === 'text') {
      ctx.fillText(seg.value, drawX, y);
      drawX += ctx.measureText(seg.value).width;
    } else {
      const img = emojiCache.get(seg.url);
      if (img) {
        // Draw emoji slightly offset so baseline aligns with text cap height
        ctx.drawImage(img, drawX, y + fontSize * 0.05, fontSize, fontSize);
      }
      drawX += fontSize;
    }
  }

  // Restore context alignment settings for subsequent drawing
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
}

// ─── Nickname Font Sizing ─────────────────────────────────────────────────────

/**
 * Returns the largest font size ≤ maxFontSize at which `- ${nickname}`
 * fits within maxWidth, shrinking until it does (or hits minFontSize).
 */
function fitNickname(ctx, nickname, maxWidth, fontFamily, maxFontSize, minFontSize) {
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

// ─── Main Quote Function ──────────────────────────────────────────────────────

async function quote(
  guild,
  _person,
  _nickname,
  _message,
  _backgroundColor,
  _textColor,
  _profileColor,
  _avatarSource,
  _fontStyle,
) {
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
  let textColor;
  if (_textColor) {
    textColor = validateAndNormaliseHex(_textColor);
  } else {
    textColor = backgroundColor === 'white' ? 'black' : 'white';
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  let pfp;
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
      pfp = _person.displayAvatarURL({ extension: 'png', size: 512 });
    }
  } else {
    pfp = _person.displayAvatarURL({ extension: 'png', size: 512 });
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
  const MAX_CONTENT_HEIGHT = 480; // canvas is 512px tall; 16px top+bottom breathing room
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
  const calcTotalHeight = (fs, wrappedLines, nfs, ufs) => {
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

module.exports = quote;
