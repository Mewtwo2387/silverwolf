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
} from '../bot-bridge';
import { type AppEnv, authedGameRequest, readGameBody } from '../shared';

const POOP_COLOURS = ['brown', 'dark-brown', 'yellow', 'green', 'black', 'red', 'holy'];
const POOP_SIZES = ['small', 'medium', 'large', 'omnipresent'];
const POOP_TYPES = ['liquid', 'soft', 'normal', 'hard', 'pellet', 'divine'];

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
    const colour = typeof body!.colour === 'string' && POOP_COLOURS.includes(body!.colour) ? body!.colour : null;
    const size = typeof body!.size === 'string' && POOP_SIZES.includes(body!.size) ? body!.size : null;
    const type = typeof body!.type === 'string' && POOP_TYPES.includes(body!.type) ? body!.type : null;
    let duration: number | null = null;
    if (typeof body!.duration === 'number' && Number.isFinite(body!.duration)) {
      const d = Math.trunc(body!.duration);
      if (d >= 1 && d <= 120) duration = d;
    }
    try {
      const result = await logPoopWeb(silverwolf, auth.discordId, colour, size, type, duration);
      return c.json(result);
    } catch (err) {
      logError('poop log failed:', err);
      return c.json({ error: 'server' }, 500);
    }
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
