import type { Context, Next } from 'hono';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import { resolveUser } from '../bot-bridge';
import {
  clearSessionCookie,
  loadSession,
  readSessionId,
  setSessionCookie,
  SESSION_TTL_MS,
} from '../auth/session';
import type { AppEnv } from '../shared';

export function sessionMiddleware(silverwolf: Silverwolf) {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.path.startsWith('/static/')) return next();
    const sessionId = readSessionId(c);
    if (!sessionId) {
      c.set('user', null);
      return next();
    }
    try {
      const session = await loadSession(silverwolf, sessionId);
      if (!session) {
        clearSessionCookie(c);
        c.set('user', null);
      } else {
        const display = await resolveUser(silverwolf, session.discordId);
        c.set('user', {
          discordId: session.discordId,
          sessionId: session.id,
          csrfToken: session.csrfToken,
          nav: { username: display.username, avatarURL: display.avatarURL, csrf: session.csrfToken },
        });
        // Sliding expiry: bump server-side TTL and re-issue the cookie so the
        // browser's maxAge stays in sync with the DB expiry.
        await silverwolf.db.webSession.touchSession(session.id, SESSION_TTL_MS);
        setSessionCookie(c, session.id);
      }
    } catch (err) {
      logError('session middleware failed:', err);
      c.set('user', null);
    }
    return next();
  };
}
