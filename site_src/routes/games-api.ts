import type { Hono } from 'hono';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  startBlackjack,
  hitBlackjack,
  standBlackjack,
  playRouletteWeb,
  playSlotsWeb,
  logPoopWeb,
  claimWeb,
  eatWeb,
  buyUpgradeWeb,
  buyAscensionUpgradeWeb,
  ascendWeb,
  getDinoUpgradesStateWeb,
  generateFakeQuoteWeb,
} from '../bot-bridge';
import { type AppEnv, authedGameRequest, readGameBody } from '../shared';
import { computeLoveCompatibility, lovePhraseFor } from '../../utils/loveCalculator';
import {
  POOP_COLOUR_VALUES,
  POOP_SIZE_VALUES,
  POOP_TYPE_VALUES,
  POOP_DURATION_MIN,
  POOP_DURATION_MAX,
} from '../../utils/poop';

// All endpoints require an authenticated session and a matching CSRF token in
// the JSON body. Return JSON.
export function registerGameApiRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  app.post('/games/blackjack/start', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const amount = typeof body!.amount === 'string' ? body!.amount : '';
    if (!amount) return c.json({ error: 'invalid' }, 400);
    try {
      const result = await startBlackjack(silverwolf, auth.discordId, amount);
      return c.json(result);
    } catch (err) {
      logError('blackjack start failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/blackjack/hit', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    try {
      const result = await hitBlackjack(silverwolf, auth.discordId);
      return c.json(result);
    } catch (err) {
      logError('blackjack hit failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/blackjack/stand', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    try {
      const result = await standBlackjack(silverwolf, auth.discordId);
      return c.json(result);
    } catch (err) {
      logError('blackjack stand failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/roulette/play', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const amount = typeof body!.amount === 'string' ? body!.amount : '';
    const betType = typeof body!.betType === 'string' ? body!.betType : '';
    const betValueRaw = body!.betValue;
    let betValue: number | null = null;
    if (typeof betValueRaw === 'number' && Number.isFinite(betValueRaw)) {
      betValue = Math.trunc(betValueRaw);
    } else if (typeof betValueRaw === 'string' && betValueRaw.trim() !== '') {
      const parsed = parseInt(betValueRaw, 10);
      if (!Number.isNaN(parsed)) betValue = parsed;
    }
    if (!amount || !betType) return c.json({ error: 'invalid' }, 400);
    try {
      const result = await playRouletteWeb(silverwolf, auth.discordId, amount, betType, betValue);
      return c.json(result);
    } catch (err) {
      logError('roulette play failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/slots/play', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const amount = typeof body!.amount === 'string' ? body!.amount : '';
    if (!amount) return c.json({ error: 'invalid' }, 400);
    try {
      const result = await playSlotsWeb(silverwolf, auth.discordId, amount);
      return c.json(result);
    } catch (err) {
      logError('slots play failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/poop/log', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const colour = typeof body!.colour === 'string' && POOP_COLOUR_VALUES.includes(body!.colour) ? body!.colour : null;
    const size = typeof body!.size === 'string' && POOP_SIZE_VALUES.includes(body!.size) ? body!.size : null;
    const type = typeof body!.type === 'string' && POOP_TYPE_VALUES.includes(body!.type) ? body!.type : null;
    let duration: number | null = null;
    if (typeof body!.duration === 'number' && Number.isFinite(body!.duration)) {
      const d = Math.trunc(body!.duration);
      if (d >= POOP_DURATION_MIN && d <= POOP_DURATION_MAX) duration = d;
    }
    try {
      const result = await logPoopWeb(silverwolf, auth.discordId, colour, size, type, duration);
      return c.json(result);
    } catch (err) {
      logError('poop log failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/dinonuggie-upgrades/state', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    try {
      const result = await getDinoUpgradesStateWeb(silverwolf, auth.discordId);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('dinonuggie state failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/dinonuggie-upgrades/eat', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const amountRaw = body!.amount;
    let amount: number;
    if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
      amount = Math.trunc(amountRaw);
    } else if (typeof amountRaw === 'string' && amountRaw.trim() !== '') {
      const parsed = parseInt(amountRaw, 10);
      if (Number.isNaN(parsed)) return c.json({ error: 'invalid' }, 400);
      amount = parsed;
    } else {
      amount = 1;
    }
    try {
      const result = await eatWeb(silverwolf, auth.discordId, amount);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('eat failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/dinonuggie-upgrades/buy-upgrade', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const upgradeId = typeof body!.upgradeId === 'number' ? Math.trunc(body!.upgradeId) : NaN;
    const amount = typeof body!.amount === 'number' ? Math.trunc(body!.amount) : 1;
    if (!Number.isFinite(upgradeId)) return c.json({ error: 'invalid' }, 400);
    try {
      const result = await buyUpgradeWeb(silverwolf, auth.discordId, upgradeId, amount);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('buy upgrade failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/dinonuggie-upgrades/buy-ascension', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    const upgradeId = typeof body!.upgradeId === 'number' ? Math.trunc(body!.upgradeId) : NaN;
    const amount = typeof body!.amount === 'number' ? Math.trunc(body!.amount) : 1;
    if (!Number.isFinite(upgradeId)) return c.json({ error: 'invalid' }, 400);
    try {
      const result = await buyAscensionUpgradeWeb(silverwolf, auth.discordId, upgradeId, amount);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('buy ascension upgrade failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/dinonuggie-upgrades/ascend', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    try {
      const result = await ascendWeb(silverwolf, auth.discordId);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('ascend failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });

  app.post('/games/fakequote/generate', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;

    const get = (k: string): string | null => {
      const v = body![k];
      if (typeof v !== 'string') return null;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    };
    const uid = get('uid');
    const message = get('message');
    if (!uid || !message) return c.json({ ok: false, error: 'invalid_options' }, 400);

    try {
      const result = await generateFakeQuoteWeb(silverwolf, auth.discordId, {
        uid,
        message,
        nickname: get('nickname'),
        background: get('background'),
        textColor: get('textColor'),
        profileColor: get('profileColor'),
        fontStyle: get('fontStyle'),
      });
      if (!result.ok && result.error === 'rate_limited') {
        const headers: Record<string, string> = {};
        if (result.retryAfter) headers['retry-after'] = String(result.retryAfter);
        return c.json(result, 429, headers);
      }
      return c.json(result);
    } catch (err) {
      logError('fakequote generate failed:', err);
      return c.json({ ok: false, error: 'server' }, 500);
    }
  });

  // Public (no auth, no CSRF) — pure hash, no DB writes. Both surfaces share
  // utils/loveCalculator.ts so the Discord command and the web page always
  // agree on the percentage for any given (input1, input2) pair.
  app.post('/games/love/calculate', async (c) => {
    const body = await readGameBody(c);
    if (!body) return c.json({ error: 'invalid_body' }, 400);
    const a = typeof body.input1 === 'string' ? body.input1 : '';
    const b = typeof body.input2 === 'string' ? body.input2 : '';
    if (!a.trim() || !b.trim()) return c.json({ error: 'invalid' }, 400);
    const percentage = computeLoveCompatibility(a, b);
    return c.json({ percentage, phrase: lovePhraseFor(percentage) });
  });

  app.post('/games/claim/claim', async (c) => {
    const body = await readGameBody(c);
    const auth = authedGameRequest(c, body);
    if (auth instanceof Response) return auth;
    try {
      const result = await claimWeb(silverwolf, auth.discordId);
      return c.json({ ok: true, data: result });
    } catch (err) {
      logError('claim failed:', err);
      return c.json({ error: 'server' }, 500);
    }
  });
}
