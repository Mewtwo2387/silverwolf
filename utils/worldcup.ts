import { formatFootballTeam } from './footballTeams';

const OPENFOOTBALL_WORLDCUP_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const CACHE_TTL_MS = 60_000;

export const MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;
export const PRE_MATCH_LEAD_MS = 5 * 60 * 1000;

export interface WorldCupMatch {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score?: { ft?: [number, number]; ht?: [number, number] };
  goals1?: { name: string; minute: string; penalty?: boolean }[];
  goals2?: { name: string; minute: string; penalty?: boolean }[];
  group?: string;
  ground?: string;
}

interface WorldCupData {
  name: string;
  matches: WorldCupMatch[];
}

let cachedMatches: WorldCupMatch[] | null = null;
let cacheExpiresAt = 0;

export function matchId(match: WorldCupMatch): string {
  return `${match.date}|${match.team1}|${match.team2}`;
}

/** Parse "13:00 UTC-6" style kickoff strings into a UTC Date. */
export function parseKickoffUtc(match: WorldCupMatch): Date | null {
  const parsed = match.time.match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d+)$/);
  if (!parsed) return null;

  const hour = Number(parsed[1]);
  const minute = Number(parsed[2]);
  const offsetHours = Number(parsed[3]);
  const [year, month, day] = match.date.split('-').map(Number);
  if (!year || !month || !day) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(offsetHours)) return null;

  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0));
}

export function isFinished(match: WorldCupMatch): boolean {
  return Boolean(match.score?.ft);
}

export function getDisplayedScore(match: WorldCupMatch): { home: number; away: number } | null {
  if (match.score?.ft) {
    return { home: match.score.ft[0], away: match.score.ft[1] };
  }
  if (match.score?.ht) {
    return { home: match.score.ht[0], away: match.score.ht[1] };
  }
  const home = match.goals1?.length ?? 0;
  const away = match.goals2?.length ?? 0;
  if (home > 0 || away > 0) return { home, away };
  return null;
}

export function formatMatchContext(match: WorldCupMatch): string {
  return [match.round, match.group].filter(Boolean).join(' · ');
}

export function formatMatchTeams(match: WorldCupMatch): string {
  return `${formatFootballTeam(match.team1)} vs ${formatFootballTeam(match.team2, 'after')}`;
}

export function formatMatchScoreTitle(
  match: WorldCupMatch,
  score: { home: number; away: number },
): string {
  return `${formatFootballTeam(match.team1)}  ${score.home} – ${score.away}  ${formatFootballTeam(match.team2, 'after')}`;
}

/** Skip catch-up announcements for matches that already kicked off before we had state. */
export function needsAnnouncementBaseline(hasState: boolean, kickoffMs: number, now: number): boolean {
  return !hasState && now >= kickoffMs;
}

export function formatMatchHeader(match: WorldCupMatch): string {
  const parts = [formatMatchTeams(match)];
  const context = formatMatchContext(match);
  if (context) parts.push(context);
  return parts.join(' · ');
}

export function formatMatchResultLine(match: WorldCupMatch): string | null {
  const score = getDisplayedScore(match);
  if (!score) return null;

  const ht = match.score?.ht ? ` (HT ${match.score.ht[0]}–${match.score.ht[1]})` : '';
  const meta = formatMatchContext(match);
  const suffix = meta ? ` — ${meta}` : '';
  const home = formatFootballTeam(match.team1);
  const away = formatFootballTeam(match.team2, 'after');
  return `${match.date} · ${home} **${score.home}–${score.away}** ${away}${ht}${suffix}`;
}

export function getFinishedMatches(
  matches: WorldCupMatch[],
  options: { team?: string; limit?: number } = {},
): WorldCupMatch[] {
  const teamQuery = options.team?.trim().toLowerCase();
  const finished = matches
    .filter((match) => isFinished(match))
    .filter((match) => {
      if (!teamQuery) return true;
      return match.team1.toLowerCase().includes(teamQuery)
        || match.team2.toLowerCase().includes(teamQuery);
    })
    .sort((a, b) => {
      const aKickoff = parseKickoffUtc(a)?.getTime() ?? 0;
      const bKickoff = parseKickoffUtc(b)?.getTime() ?? 0;
      return bKickoff - aKickoff;
    });

  if (options.limit != null) return finished.slice(0, options.limit);
  return finished;
}

export async function fetchWorldCupMatches(): Promise<WorldCupMatch[]> {
  const now = Date.now();
  if (cachedMatches && now < cacheExpiresAt) return cachedMatches;

  const response = await fetch(OPENFOOTBALL_WORLDCUP_URL);
  if (!response.ok) {
    throw new Error(`World Cup data fetch failed: HTTP ${response.status}`);
  }

  const data = await response.json() as WorldCupData;
  cachedMatches = Array.isArray(data.matches) ? data.matches : [];
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedMatches;
}

/** Test helper — clears the in-memory fetch cache. */
export function clearWorldCupCache(): void {
  cachedMatches = null;
  cacheExpiresAt = 0;
}
