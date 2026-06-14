import type { Context } from 'hono';
import type { NavUser } from './components/navbar';
import { constantTimeEqual } from './auth/session';

export interface SessionUser {
  discordId: string;
  sessionId: string;
  csrfToken: string;
  nav: NavUser;
}

export interface AppEnv {
  Variables: {
    nonce: string;
    user: SessionUser | null;
  };
}

export const navUser = (c: Context<AppEnv>): NavUser | null => {
  const u = c.get('user');
  return u ? u.nav : null;
};

export type GameBody = Record<string, unknown> & { csrf?: unknown };

export async function readGameBody(c: Context<AppEnv>): Promise<GameBody | null> {
  try {
    return await c.req.json() as GameBody;
  } catch {
    return null;
  }
}

export function authedGameRequest(
  c: Context<AppEnv>,
  body: GameBody | null,
): SessionUser | Response {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  const token = typeof body.csrf === 'string' ? body.csrf : '';
  if (!token || !constantTimeEqual(token, user.csrfToken)) {
    return c.json({ error: 'csrf' }, 403);
  }
  return user;
}
