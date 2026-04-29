const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USERS_ME_URL = 'https://discord.com/api/users/@me';
const SCOPE = 'identify';
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export interface DiscordMe {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function fetchTimeoutMs(): number {
  const raw = process.env.DISCORD_FETCH_TIMEOUT_MS;
  if (!raw) return DEFAULT_FETCH_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FETCH_TIMEOUT_MS;
}

async function fetchWithTimeout(url: string, init: RequestInit, label: string): Promise<Response> {
  const controller = new AbortController();
  const ms = fetchTimeoutMs();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(`${label} timed out after ${ms}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function getRedirectUri(): string {
  return requireEnv('OAUTH_REDIRECT_URI');
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('CLIENT_ID'),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    client_id: requireEnv('CLIENT_ID'),
    client_secret: requireEnv('DISCORD_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
  });
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }, 'Discord token exchange');
  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error('Discord token response missing access_token');
  return { accessToken: json.access_token };
}

export async function fetchDiscordMe(accessToken: string): Promise<DiscordMe> {
  const res = await fetchWithTimeout(USERS_ME_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  }, 'Discord /users/@me');
  if (!res.ok) {
    throw new Error(`Discord /users/@me failed: ${res.status} ${await res.text()}`);
  }
  return await res.json() as DiscordMe;
}
