import type { Silverwolf } from '../classes/silverwolf';

const MEMBER_CACHE_MS = 5 * 60_000;
const memberCache = new Map<string, { ok: boolean; at: number }>();

export function getConfiguredGuildIds(): string[] {
  const raw = process.env.GUILD_ID ?? '';
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

function isDevUser(discordId: string): boolean {
  const raw = process.env.ALLOWED_USERS ?? '';
  return raw.split(',').map((id) => id.trim()).filter(Boolean).includes(discordId);
}

async function isMemberOfGuild(
  silverwolf: Silverwolf,
  guildId: string,
  discordId: string,
): Promise<boolean> {
  const guild = silverwolf.guilds.cache.get(guildId);
  if (!guild) return false;
  try {
    await guild.members.fetch(discordId);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the user may use website AI: logged-in checks are separate;
 * here we require membership in at least one GUILD_ID server (or ALLOWED_USERS).
 */
export async function canUseAiSlop(silverwolf: Silverwolf, discordId: string): Promise<boolean> {
  if (isDevUser(discordId)) return true;

  const guildIds = getConfiguredGuildIds();
  if (guildIds.length === 0) return false;

  const cached = memberCache.get(discordId);
  if (cached && Date.now() - cached.at < MEMBER_CACHE_MS) return cached.ok;

  if (!silverwolf.isReady()) return false;

  const checks = await Promise.all(
    guildIds.map((guildId) => isMemberOfGuild(silverwolf, guildId, discordId)),
  );
  const ok = checks.some(Boolean);
  memberCache.set(discordId, { ok, at: Date.now() });
  return ok;
}
