import type { WorldCupMatch } from './worldcup';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const CACHE_TTL_MS = 30_000;
const FIXTURE_BATCH_SIZE = 20;

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);

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

interface ApiFootballTeam {
  id: number;
  name: string;
}

interface ApiFootballEvent {
  time: { elapsed: number | null; extra: number | null };
  team: ApiFootballTeam;
  player: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

interface ApiFootballFixtureItem {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue?: { name?: string | null; city?: string | null } | null;
  };
  league: {
    round?: string | null;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime?: { home: number | null; away: number | null };
    penalty?: { home: number | null; away: number | null };
  };
  events?: ApiFootballEvent[];
}

interface ApiFootballResponse<T> {
  response: T;
  errors: Record<string, string> | unknown[];
}

let cachedMatches: WorldCupMatch[] | null = null;
let cacheExpiresAt = 0;
const finishedEventsByFixtureId = new Map<number, ApiFootballEvent[]>();

export function normalizeTeamName(apiName: string): string {
  return TEAM_NAME_ALIASES[apiName] ?? apiName;
}

export function formatEventMinute(elapsed: number | null, extra: number | null): string {
  const minute = elapsed ?? 0;
  if (extra) return `${minute}+${extra}`;
  return String(minute);
}

export function mapApiFootballStatus(short: string): string {
  if (FINISHED_STATUSES.has(short)) return 'FINISHED';
  if (LIVE_STATUSES.has(short)) return short;
  return short;
}

function isPenaltyGoal(detail: string): boolean {
  const lower = detail.toLowerCase();
  if (lower.includes('missed penalty')) return false;
  return lower.includes('penalty');
}

function isMissedPenalty(detail: string): boolean {
  return detail.toLowerCase().includes('missed penalty');
}

/** Penalty-shootout kicks are logged at 120+1, 120+2, … — not in-play penalties. */
function isShootoutEvent(event: ApiFootballEvent): boolean {
  if (event.time.elapsed !== 120 || event.time.extra == null) return false;
  const lower = event.detail.toLowerCase();
  return lower.includes('penalty');
}

function goalCreditedToHome(
  event: ApiFootballEvent,
  homeId: number,
  awayId: number,
  homeName: string,
): boolean {
  if (event.team.id === homeId) return true;
  if (event.team.id === awayId) return false;
  return normalizeTeamName(event.team.name) === homeName;
}

function parseShootoutKicks(
  events: ApiFootballEvent[] | undefined,
  item: ApiFootballFixtureItem,
  team1: string,
  team2: string,
): NonNullable<WorldCupMatch['shootoutKicks']> {
  const shootoutEvents = (events ?? [])
    .filter(isShootoutEvent)
    .sort((a, b) => (a.time.extra ?? 0) - (b.time.extra ?? 0));

  return shootoutEvents.map((event) => {
    const player = event.player?.name?.trim() || 'Unknown';
    const team = goalCreditedToHome(event, item.teams.home.id, item.teams.away.id, team1)
      ? team1
      : team2;
    return {
      team,
      player,
      scored: isPenaltyGoal(event.detail),
    };
  });
}

export function mapApiFootballFixture(item: ApiFootballFixtureItem): WorldCupMatch {
  const team1 = normalizeTeamName(item.teams.home.name);
  const team2 = normalizeTeamName(item.teams.away.name);
  const kickoff = new Date(item.fixture.date);
  const date = item.fixture.date.slice(0, 10);
  const time = `${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')} UTC+0`;

  const score: WorldCupMatch['score'] = {};
  const ftHome = item.score.fulltime.home ?? item.goals.home;
  const ftAway = item.score.fulltime.away ?? item.goals.away;
  if (ftHome != null && ftAway != null) {
    score.ft = [ftHome, ftAway];
  }
  const { halftime } = item.score;
  if (halftime.home != null && halftime.away != null) {
    score.ht = [halftime.home, halftime.away];
  }
  const penHome = item.score.penalty?.home;
  const penAway = item.score.penalty?.away;
  if (penHome != null && penAway != null) {
    score.penalty = [penHome, penAway];
  }

  const shootoutKicks = parseShootoutKicks(item.events, item, team1, team2);

  const goals1: NonNullable<WorldCupMatch['goals1']> = [];
  const goals2: NonNullable<WorldCupMatch['goals2']> = [];
  for (const event of item.events ?? []) {
    if (event.type !== 'Goal') continue;
    if (isShootoutEvent(event)) continue;
    if (isMissedPenalty(event.detail)) continue;
    const scorerName = event.player?.name?.trim();
    if (!scorerName) continue;

    const entry = {
      name: scorerName,
      minute: formatEventMinute(event.time.elapsed, event.time.extra),
      penalty: isPenaltyGoal(event.detail),
    };

    if (goalCreditedToHome(event, item.teams.home.id, item.teams.away.id, team1)) {
      goals1.push(entry);
    } else {
      goals2.push(entry);
    }
  }

  const venue = item.fixture.venue?.name ?? item.fixture.venue?.city ?? undefined;

  return {
    round: item.league.round ?? '',
    date,
    time,
    team1,
    team2,
    score: Object.keys(score).length > 0 ? score : undefined,
    goals1: goals1.length > 0 ? goals1 : undefined,
    goals2: goals2.length > 0 ? goals2 : undefined,
    shootoutKicks: shootoutKicks.length > 0 ? shootoutKicks : undefined,
    group: item.league.round ?? undefined,
    ground: venue ?? undefined,
    kickoffUtc: kickoff.toISOString(),
    status: mapApiFootballStatus(item.fixture.status.short),
  };
}

function collectFixtureIdsNeedingEvents(fixtures: ApiFootballFixtureItem[]): number[] {
  const ids = new Set<number>();
  for (const item of fixtures) {
    const { short } = item.fixture.status;
    if (LIVE_STATUSES.has(short)) {
      ids.add(item.fixture.id);
      continue;
    }
    if (FINISHED_STATUSES.has(short) && !finishedEventsByFixtureId.has(item.fixture.id)) {
      ids.add(item.fixture.id);
    }
  }
  return [...ids];
}

function mergeFixtureDetail(
  item: ApiFootballFixtureItem,
  detailsById: Map<number, ApiFootballFixtureItem>,
  eventsById: Map<number, ApiFootballEvent[]>,
): ApiFootballFixtureItem {
  const detail = detailsById.get(item.fixture.id);
  const events = detail?.events ?? eventsById.get(item.fixture.id);
  if (!detail && !events) return item;

  return {
    ...item,
    goals: detail?.goals ?? item.goals,
    score: detail?.score ?? item.score,
    events: events ?? item.events,
    fixture: detail
      ? { ...item.fixture, status: detail.fixture.status }
      : item.fixture,
  };
}

async function apiFootballRequest<T>(path: string, key: string): Promise<T> {
  const response = await fetch(`${API_FOOTBALL_BASE}${path}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!response.ok) {
    throw new Error(`api-football request failed: HTTP ${response.status} (${path})`);
  }

  const data = await response.json() as ApiFootballResponse<T>;
  if (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors ?? {}).length > 0) {
    throw new Error(`api-football request failed: ${JSON.stringify(data.errors)} (${path})`);
  }
  return data.response;
}

async function fetchFixtureBatch(ids: number[], key: string): Promise<ApiFootballFixtureItem[]> {
  if (ids.length === 0) return [];
  const joined = ids.join('-');
  return apiFootballRequest<ApiFootballFixtureItem[]>(`/fixtures?ids=${joined}`, key);
}

function chunkIds(ids: number[]): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += FIXTURE_BATCH_SIZE) {
    chunks.push(ids.slice(i, i + FIXTURE_BATCH_SIZE));
  }
  return chunks;
}

function getApiFootballKey(): string {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  if (!key) {
    throw new Error('API_FOOTBALL_KEY is required for World Cup match data');
  }
  return key;
}

export async function fetchWorldCupMatches(): Promise<WorldCupMatch[]> {
  const key = getApiFootballKey();
  const now = Date.now();
  if (cachedMatches && now < cacheExpiresAt) return cachedMatches;

  const fixtures = await apiFootballRequest<ApiFootballFixtureItem[]>(
    `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`,
    key,
  );

  const idsToFetch = collectFixtureIdsNeedingEvents(fixtures ?? []);
  const fetchedDetailsById = new Map<number, ApiFootballFixtureItem>();
  for (const chunk of chunkIds(idsToFetch)) {
    const batch = await fetchFixtureBatch(chunk, key);
    for (const item of batch) {
      fetchedDetailsById.set(item.fixture.id, item);
      if (item.events && FINISHED_STATUSES.has(item.fixture.status.short)) {
        finishedEventsByFixtureId.set(item.fixture.id, item.events);
      }
    }
  }

  const eventsById = new Map<number, ApiFootballEvent[]>(finishedEventsByFixtureId);
  for (const [id, detail] of fetchedDetailsById) {
    if (detail.events) eventsById.set(id, detail.events);
  }

  const matches = (fixtures ?? []).map((item) => mapApiFootballFixture(
    mergeFixtureDetail(item, fetchedDetailsById, eventsById),
  ));

  cachedMatches = matches;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return matches;
}

/** Test helper — clears the in-memory match fetch cache. */
export function clearFootballDataCache(): void {
  cachedMatches = null;
  cacheExpiresAt = 0;
  finishedEventsByFixtureId.clear();
}
