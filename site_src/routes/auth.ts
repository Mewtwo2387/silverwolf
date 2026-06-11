import type { Hono } from 'hono';
import { html, raw as rawHtml } from 'hono/html';
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
  signedToken,
} from '../auth/session';
import type { AppEnv } from '../shared';

export function registerAuthRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  app.get('/auth/discord/login', (c) => {
    try {
      // The Android app appends ?app=true. Encode that in the OAuth state
      // (echoed back by Discord) instead of a separate cookie — cookies set
      // on the redirect hop are easy to lose across the external-browser
      // round trip, and the state is already CSRF-verified.
      const isApp = c.req.query('app') === 'true';
      const state = isApp ? `${newRandomId(16)}.app` : newRandomId(16);
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

      const isApp = state.endsWith('.app');

      if (isApp) {
        // Chrome on Android blocks server redirects to custom schemes without
        // a user gesture, so a bare 302 to silverwolf:// dies silently. Serve
        // an interstitial that auto-attempts the deep link and keeps a
        // tappable fallback (a click is always allowed to leave the browser).
        const deepLink = `silverwolf://login?session=${signedToken(sessionId)}`;
        const nonce = c.get('nonce');
        return c.html(html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <title>Returning to the app…</title>
</head>
<body style="background:#06080F;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:1.5rem;margin:0">
  <p>Logged in! Sending you back to the app…</p>
  <a href="${deepLink}" style="background:#4C6EF5;color:#fff;padding:.75rem 1.5rem;border-radius:.5rem;text-decoration:none">Open the app</a>
  <script nonce="${nonce}">location.href = ${rawHtml(JSON.stringify(deepLink))};</script>
</body>
</html>`);
      }

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
