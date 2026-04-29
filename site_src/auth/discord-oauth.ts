const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USERS_ME_URL = 'https://discord.com/api/users/@me';
const SCOPE = 'identify';

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
    prompt: 'none',
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
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error('Discord token response missing access_token');
  return { accessToken: json.access_token };
}

export async function fetchDiscordMe(accessToken: string): Promise<DiscordMe> {
  const res = await fetch(USERS_ME_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord /users/@me failed: ${res.status} ${await res.text()}`);
  }
  return await res.json() as DiscordMe;
}
