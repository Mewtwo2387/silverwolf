import type { WorldCupMatch } from './worldcup';

const FOOTBALL_DATA_API_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_SEASON = 2026;
const LIVE_CACHE_TTL_MS = 30_000;

const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', 'PAUSED', 'HALFTIME']);

const TEAM_NAME_ALIASES: Record<string, string> = {
  'United States': 'USA',
  USA: 'USA',
  'Korea Republic': 'South Korea',
  'South Korea': 'South Korea',
  Czechia: 'Czech Republic',
  "Côte d'Ivoire": 'Ivory Coast',
  'Ivory Coast': 'Ivory Coast',
  'IR Iran': 'Iran',
  Iran: 'Iran',
  'Cabo Verde': 'Cape Verde',
  'Cape Verde': 'Cape Verde',
  'Congo DR': 'DR Congo',
  'DR Congo': 'DR Congo',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  Türkiye: 'Turkey',
  Turkey: 'Turkey',
  Curacao: 'Curaçao',
  Curaçao: 'Curaçao',
};

interface FootballDataTeam {
  id: number;
  name: string;
  shortName?: string;
}

interface FootballDataGoal {
  minute: number;
  extraTime?: number | null;
  injuryTime?: number | null;
  type?: string;
  team: FootballDataTeam;
  scorer?: { id?: number; name?: string | null };
}

interface FootballDataScoreSide {
  home: number | null;
  away: number | null;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage?: string | null;
  group?: string | null;
  venue?: string | null;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score: {
    fullTime: FootballDataScoreSide;
    halfTime: FootballDataScoreSide;
  };
  goals?: FootballDataGoal[];
}

let cachedLiveMatches: WorldCupMatch[] | null = null;
let liveCacheExpiresAt = 0;

export function normalizeTeamName(apiName: string): string {
  return TEAM_NAME_ALIASES[apiName] ?? apiName;
}

export function formatApiGoalMinute(minute: number, extraTime?: number | null): string {
  if (extraTime) return `${minute}+${extraTime}`;
  return String(minute);
}

export function mapFootballDataMatch(match: FootballDataMatch): WorldCupMatch {
  const team1 = normalizeTeamName(match.homeTeam.name);
  const team2 = normalizeTeamName(match.awayTeam.name);
  const kickoff = new Date(match.utcDate);
  const date = match.utcDate.slice(0, 10);
  const time = `${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')} UTC+0`;

  const score: WorldCupMatch['score'] = {};
  const { fullTime, halfTime } = match.score;
  if (fullTime.home != null && fullTime.away != null) {
    score.ft = [fullTime.home, fullTime.away];
  }
  if (halfTime.home != null && halfTime.away != null) {
    score.ht = [halfTime.home, halfTime.away];
  }

  const goals1: NonNullable<WorldCupMatch['goals1']> = [];
  const goals2: NonNullable<WorldCupMatch['goals2']> = [];
  for (const goal of match.goals ?? []) {
    const scorerName = goal.scorer?.name?.trim();
    if (!scorerName) continue;

    const entry = {
      name: scorerName,
      minute: formatApiGoalMinute(goal.minute, goal.injuryTime ?? goal.extraTime),
      penalty: goal.type === 'PENALTY',
    };
    if (goal.team.id === match.homeTeam.id) goals1.push(entry);
    else if (goal.team.id === match.awayTeam.id) goals2.push(entry);
    else if (normalizeTeamName(goal.team.name) === team1) goals1.push(entry);
    else goals2.push(entry);
  }

  return {
    round: match.stage ?? '',
    date,
    time,
    team1,
    team2,
    score: Object.keys(score).length > 0 ? score : undefined,
    goals1: goals1.length > 0 ? goals1 : undefined,
    goals2: goals2.length > 0 ? goals2 : undefined,
    group: match.group ?? undefined,
    ground: match.venue ?? undefined,
    kickoffUtc: match.utcDate,
    status: match.status,
  };
}

async function footballDataRequest<T>(
  path: string,
  token: string,
  options: { unfoldGoals?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'X-Auth-Token': token };
  if (options.unfoldGoals !== false) headers['X-Unfold-Goals'] = 'true';

  const response = await fetch(`${FOOTBALL_DATA_API_BASE}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`football-data.org request failed: HTTP ${response.status} (${path})`);
  }
  return response.json() as Promise<T>;
}

function mappedGoalCount(match: WorldCupMatch): number {
  return (match.goals1?.length ?? 0) + (match.goals2?.length ?? 0);
}

function matchNeedsDetail(summary: FootballDataMatch, mapped: WorldCupMatch): boolean {
  if (LIVE_STATUSES.has(summary.status)) return true;
  if (mappedGoalCount(mapped) > 0) return false;
  if (summary.status !== 'FINISHED') return false;
  return Date.now() - new Date(summary.utcDate).getTime() < 3 * 60 * 60 * 1000;
}

async function fetchFootballDataMatchDetail(id: number, token: string): Promise<FootballDataMatch> {
  const data = await footballDataRequest<FootballDataMatch | { match: FootballDataMatch }>(
    `/matches/${id}`,
    token,
    { unfoldGoals: true },
  );
  return 'match' in data ? data.match : data;
}

function getFootballDataToken(): string {
  const token = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!token) {
    throw new Error('FOOTBALL_DATA_API_KEY is required for World Cup match data');
  }
  return token;
}

export async function fetchWorldCupMatches(): Promise<WorldCupMatch[]> {
  const token = getFootballDataToken();
  const now = Date.now();
  if (cachedLiveMatches && now < liveCacheExpiresAt) return cachedLiveMatches;

  const list = await footballDataRequest<{ matches: FootballDataMatch[] }>(
    `/competitions/WC/matches?season=${FOOTBALL_DATA_SEASON}`,
    token,
    { unfoldGoals: true },
  );

  const matches: WorldCupMatch[] = [];
  for (const summary of list.matches ?? []) {
    const mapped = mapFootballDataMatch(summary);
    if (!matchNeedsDetail(summary, mapped)) {
      matches.push(mapped);
      continue;
    }

    try {
      const detail = await fetchFootballDataMatchDetail(summary.id, token);
      matches.push(mapFootballDataMatch(detail));
    } catch {
      matches.push(mapped);
    }
  }

  cachedLiveMatches = matches;
  liveCacheExpiresAt = now + LIVE_CACHE_TTL_MS;
  return matches;
}

/** Test helper — clears the in-memory match fetch cache. */
export function clearFootballDataCache(): void {
  cachedLiveMatches = null;
  liveCacheExpiresAt = 0;
}
