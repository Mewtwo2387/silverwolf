import type { Hono } from 'hono';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordMe,
} from '../auth/discord-oauth';
import {
  clearOAuthStateCookie,
  clearReturnCookie,
  clearSessionCookie,
  constantTimeEqual,
  createSession,
  isSafeReturnPath,
  newRandomId,
  readOAuthStateCookie,
  readReturnCookie,
  setOAuthStateCookie,
  setReturnCookie,
  setSessionCookie,
} from '../auth/session';
import type { AppEnv } from '../shared';

export function registerAuthRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  app.get('/auth/discord/login', (c) => {
    try {
      const state = newRandomId(16);
      setOAuthStateCookie(c, state);
      // Optional ?return=/some/path — restored after OAuth callback. Rejected
      // unless it's a same-origin absolute path so we can't be turned into an
      // open redirect.
      const returnTo = c.req.query('return');
      if (isSafeReturnPath(returnTo)) {
        setReturnCookie(c, returnTo);
      } else {
        clearReturnCookie(c);
      }
      return c.redirect(buildAuthorizeUrl(state));
    } catch (err) {
      logError('login init failed:', err);
      return c.text('Login is not configured', 500);
    }
  });

  app.get('/auth/discord/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const expectedState = readOAuthStateCookie(c);
    clearOAuthStateCookie(c);

    if (!code || !state || !expectedState || !constantTimeEqual(state, expectedState)) {
      return c.text('Invalid OAuth state', 400);
    }

    try {
      const { accessToken } = await exchangeCode(code);
      const me = await fetchDiscordMe(accessToken);
      // Ensure a User row exists so downstream pages can read stats by Discord ID.
      await silverwolf.db.user.getUser(me.id);
      const { id: sessionId } = await createSession(silverwolf, me.id);
      setSessionCookie(c, sessionId);
      const returnTo = readReturnCookie(c);
      clearReturnCookie(c);
      return c.redirect(returnTo ?? '/me');
    } catch (err) {
      logError('OAuth callback failed:', err);
      return c.text('Login failed', 500);
    }
  });

  app.post('/auth/logout', async (c) => {
    const user = c.get('user');
    if (user) {
      // CSRF: validate the form-supplied token against the per-session
      // token. SameSite=Lax already blocks cross-origin POST cookies, but
      // this closes any future hole if a sibling endpoint relaxes that.
      let formToken = '';
      try {
        const body = await c.req.parseBody();
        const raw = (body as Record<string, unknown>).csrf;
        formToken = typeof raw === 'string' ? raw : '';
      } catch {
        formToken = '';
      }
      if (!formToken || !constantTimeEqual(formToken, user.csrfToken)) {
        return c.text('CSRF check failed', 403);
      }
      try {
        await silverwolf.db.webSession.deleteSession(user.sessionId);
      } catch (err) {
        logError('logout failed:', err);
      }
    }
    clearSessionCookie(c);
    return c.redirect('/');
  });
}
