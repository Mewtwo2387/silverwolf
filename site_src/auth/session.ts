import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Silverwolf } from '../../classes/silverwolf';
import type { WebSession } from '../../database/models/WebSessionModel';

export const SESSION_COOKIE = 'sw_session';
export const OAUTH_STATE_COOKIE = 'sw_oauth_state';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_TTL_S = 5 * 60;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function signedToken(value: string): string {
  return `${value}.${sign(value)}`;
}

function verifySigned(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const value = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(value);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return value;
}

export function newRandomId(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function baseCookieOpts() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'Lax' as const,
    path: '/',
  };
}

export function setSessionCookie(c: Context, sessionId: string) {
  setCookie(c, SESSION_COOKIE, signedToken(sessionId), {
    ...baseCookieOpts(),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function readSessionId(c: Context): string | null {
  return verifySigned(getCookie(c, SESSION_COOKIE));
}

export function setOAuthStateCookie(c: Context, state: string) {
  setCookie(c, OAUTH_STATE_COOKIE, signedToken(state), {
    ...baseCookieOpts(),
    maxAge: OAUTH_STATE_TTL_S,
  });
}

export function readOAuthStateCookie(c: Context): string | null {
  return verifySigned(getCookie(c, OAUTH_STATE_COOKIE));
}

export function clearOAuthStateCookie(c: Context) {
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
}

export async function loadSession(
  silverwolf: Silverwolf,
  sessionId: string,
): Promise<WebSession | null> {
  const session = await silverwolf.db.webSession.getSession(sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await silverwolf.db.webSession.deleteSession(sessionId);
    return null;
  }
  return session;
}

export async function createSession(
  silverwolf: Silverwolf,
  discordId: string,
): Promise<{ id: string; csrfToken: string }> {
  const id = newRandomId();
  const csrfToken = newRandomId(16);
  await silverwolf.db.webSession.createSession(id, discordId, csrfToken, SESSION_TTL_MS);
  return { id, csrfToken };
}

// Note: not fully constant-time — the early length-mismatch return leaks
// the length of `a` vs `b`. Acceptable here because the compared values
// (CSRF tokens) have a fixed, non-secret length.
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
