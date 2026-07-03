import type { Context, Hono } from 'hono';
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
import {
  type AppEnv, type GameBody, authedGameRequest, coerceInt, readGameBody,
} from '../shared';
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
  // Shared shell for authenticated game POSTs: parse body, enforce session +
  // CSRF, then run the handler. The handler validates its own inputs (returning
  // a Response for a 400) and returns either a Response or a plain object to be
  // JSON-encoded. Any throw is logged and surfaced as a 500.
  const gameRoute = (
    path: string,
    label: string,
    handler: (a: { c: Context<AppEnv>; body: GameBody; discordId: string }) => Promise<Response | unknown>,
  ) => {
    app.post(path, async (c) => {
      const body = await readGameBody(c);
      const auth = authedGameRequest(c, body);
      if (auth instanceof Response) return auth;
      try {
        const result = await handler({ c, body: body!, discordId: auth.discordId });
        return result instanceof Response ? result : c.json(result);
      } catch (err) {
        logError(`${label} failed:`, err);
        return c.json({ error: 'server' }, 500);
      }
    });
  };

  // Optional quantity: absent means 1; a provided-but-malformed value (e.g.
  // "abc", 0, negative) is rejected rather than silently treated as 1.
  const parseQuantity = (raw: unknown): number | null => {
    if (raw === undefined) return 1;
    const n = coerceInt(raw);
    return n !== null && n >= 1 ? n : null;
  };

  gameRoute('/games/blackjack/start', 'blackjack start', async ({ c, body, discordId }) => {
    const amount = typeof body.amount === 'string' ? body.amount : '';
    if (!amount) return c.json({ error: 'invalid' }, 400);
    return startBlackjack(silverwolf, discordId, amount);
  });

  gameRoute('/games/blackjack/hit', 'blackjack hit', ({ discordId }) => hitBlackjack(silverwolf, discordId));

  gameRoute('/games/blackjack/stand', 'blackjack stand', ({ discordId }) => standBlackjack(silverwolf, discordId));

  gameRoute('/games/roulette/play', 'roulette play', async ({ c, body, discordId }) => {
    const amount = typeof body.amount === 'string' ? body.amount : '';
    const betType = typeof body.betType === 'string' ? body.betType : '';
    const betValue = coerceInt(body.betValue);
    if (!amount || !betType) return c.json({ error: 'invalid' }, 400);
    return playRouletteWeb(silverwolf, discordId, amount, betType, betValue);
  });

  gameRoute('/games/slots/play', 'slots play', async ({ c, body, discordId }) => {
    const amount = typeof body.amount === 'string' ? body.amount : '';
    if (!amount) return c.json({ error: 'invalid' }, 400);
    return playSlotsWeb(silverwolf, discordId, amount);
  });

  gameRoute('/games/poop/log', 'poop log', ({ body, discordId }) => {
    const colour = typeof body.colour === 'string' && POOP_COLOUR_VALUES.includes(body.colour) ? body.colour : null;
    const size = typeof body.size === 'string' && POOP_SIZE_VALUES.includes(body.size) ? body.size : null;
    const type = typeof body.type === 'string' && POOP_TYPE_VALUES.includes(body.type) ? body.type : null;
    const d = coerceInt(body.duration);
    const duration = d !== null && d >= POOP_DURATION_MIN && d <= POOP_DURATION_MAX ? d : null;
    return logPoopWeb(silverwolf, discordId, colour, size, type, duration);
  });

  gameRoute('/games/dinonuggie-upgrades/state', 'dinonuggie state', async ({ discordId }) => ({
    ok: true, data: await getDinoUpgradesStateWeb(silverwolf, discordId),
  }));

  gameRoute('/games/dinonuggie-upgrades/eat', 'eat', async ({ c, body, discordId }) => {
    const amount = parseQuantity(body.amount);
    if (amount === null) return c.json({ error: 'invalid' }, 400);
    return { ok: true, data: await eatWeb(silverwolf, discordId, amount) };
  });

  gameRoute('/games/dinonuggie-upgrades/buy-upgrade', 'buy upgrade', async ({ c, body, discordId }) => {
    const upgradeId = coerceInt(body.upgradeId);
    const amount = parseQuantity(body.amount);
    if (upgradeId === null || amount === null) return c.json({ error: 'invalid' }, 400);
    return { ok: true, data: await buyUpgradeWeb(silverwolf, discordId, upgradeId, amount) };
  });

  gameRoute('/games/dinonuggie-upgrades/buy-ascension', 'buy ascension upgrade', async ({ c, body, discordId }) => {
    const upgradeId = coerceInt(body.upgradeId);
    const amount = parseQuantity(body.amount);
    if (upgradeId === null || amount === null) return c.json({ error: 'invalid' }, 400);
    return { ok: true, data: await buyAscensionUpgradeWeb(silverwolf, discordId, upgradeId, amount) };
  });

  gameRoute('/games/dinonuggie-upgrades/ascend', 'ascend', async ({ discordId }) => ({
    ok: true, data: await ascendWeb(silverwolf, discordId),
  }));

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
        format: get('format'),
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

  gameRoute('/games/claim/claim', 'claim', async ({ discordId }) => ({
    ok: true, data: await claimWeb(silverwolf, discordId),
  }));
}
