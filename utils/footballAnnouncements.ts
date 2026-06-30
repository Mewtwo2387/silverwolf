import { EmbedBuilder } from 'discord.js';
import { formatFootballTeam } from './footballTeams';
import {
  formatMatchContext,
  formatMatchScoreTitle,
  formatMatchTeams,
  getDisplayedScore,
  getPenaltyShootoutTally,
  isFinished,
  parseKickoffUtc,
  PRE_MATCH_LEAD_MS,
  type WorldCupMatch,
} from './worldcup';
import type { FootballMatchAnnouncementState } from '../database/models/FootballMatchAnnouncementModel';
import { displayScorerName } from './footballEasterEggs';

export interface GoalEvent {
  home: number;
  away: number;
  scorer: string;
  minute: string;
  penalty?: boolean;
  team: string;
}

export function buildPreMatchEmbed(match: WorldCupMatch, kickoff: Date): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(`⚽ ${formatMatchTeams(match)}`)
    .setDescription(
      `${context ? `${context}\n` : ''}Kickoff in **5 minutes** (<t:${Math.floor(kickoff.getTime() / 1000)}:R>).`,
    )
    .setColor(0x1E90FF);
}

export function formatHighlightedScore(
  home: number,
  away: number,
  scoringSide: 'home' | 'away',
): string {
  const homeStr = scoringSide === 'home' ? `[${home}]` : `${home}`;
  const awayStr = scoringSide === 'away' ? `[${away}]` : `${away}`;
  return `${homeStr} – ${awayStr}`;
}

export function formatHighlightedScoreFromDelta(
  home: number,
  away: number,
  prevHome: number,
  prevAway: number,
): string {
  const homeStr = home > prevHome ? `[${home}]` : `${home}`;
  const awayStr = away > prevAway ? `[${away}]` : `${away}`;
  return `${homeStr} – ${awayStr}`;
}

function formatMatchScoreTitleWithHighlight(
  match: WorldCupMatch,
  score: { home: number; away: number },
  prevScore: { home: number; away: number },
): string {
  const scoreLine = formatHighlightedScoreFromDelta(
    score.home,
    score.away,
    prevScore.home,
    prevScore.away,
  );
  return `${formatFootballTeam(match.team1)}  ${scoreLine}  ${formatFootballTeam(match.team2, 'after')}`;
}

export function formatGoalTitle(match: WorldCupMatch, goal: GoalEvent): string {
  const scoringSide = goal.team === match.team1 ? 'home' : 'away';
  const scoreLine = formatHighlightedScore(goal.home, goal.away, scoringSide);
  return `${formatFootballTeam(match.team1)}  ${scoreLine}  ${formatFootballTeam(match.team2, 'after')}`;
}

function formatGoalScorerLine(goal: GoalEvent): string {
  const pen = goal.penalty ? ' (pen)' : '';
  return `⚽ **${displayScorerName(goal)}** · ${goal.minute}'${pen}`;
}

export function buildGoalEmbed(match: WorldCupMatch, goal: GoalEvent): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(formatGoalTitle(match, goal))
    .setDescription(context ? `${formatGoalScorerLine(goal)}\n${context}` : formatGoalScorerLine(goal))
    .setColor(0xFFD700);
}

export function buildScoreUpdateEmbed(
  match: WorldCupMatch,
  score: { home: number; away: number },
  prevScore: { home: number; away: number } = { home: 0, away: 0 },
): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(formatMatchScoreTitleWithHighlight(match, score, prevScore))
    .setDescription(context || 'Live score')
    .setColor(0xFFD700);
}

function parseGoalMinute(minute: string): number {
  const parsed = minute.match(/^(\d+)(?:\+(\d+))?$/);
  if (!parsed) return 999;
  return Number(parsed[1]) + Number(parsed[2] ?? 0);
}

export function getGoalEvents(match: WorldCupMatch): GoalEvent[] {
  const events = [
    ...(match.goals1 ?? []).map((goal) => ({
      side: 1 as const,
      name: goal.name,
      minute: goal.minute,
      penalty: goal.penalty,
    })),
    ...(match.goals2 ?? []).map((goal) => ({
      side: 2 as const,
      name: goal.name,
      minute: goal.minute,
      penalty: goal.penalty,
    })),
  ].sort((a, b) => parseGoalMinute(a.minute) - parseGoalMinute(b.minute));

  let home = 0;
  let away = 0;
  return events.map((event) => {
    if (event.side === 1) home += 1;
    else away += 1;
    return {
      home,
      away,
      scorer: event.name,
      minute: event.minute,
      penalty: event.penalty,
      team: event.side === 1 ? match.team1 : match.team2,
    };
  });
}

function formatGoalSummary(match: WorldCupMatch): string {
  return getGoalEvents(match).map((goal) => formatGoalScorerLine(goal)).join('\n');
}

export function buildFullTimeEmbed(
  match: WorldCupMatch,
  score: { home: number; away: number },
): EmbedBuilder {
  const context = formatMatchContext(match);
  const scorers = formatGoalSummary(match);
  const header = context ? `Full Time · ${context}` : 'Full Time';
  const description = scorers ? `${header}\n\n${scorers}` : header;

  return new EmbedBuilder()
    .setTitle(formatMatchScoreTitle(match, score))
    .setDescription(description)
    .setColor(0x228B22);
}

function formatShootoutKickLine(kick: NonNullable<WorldCupMatch['shootoutKicks']>[number]): string {
  const icon = kick.scored ? '✅' : '❌';
  return `${icon} **${kick.player}** · ${formatFootballTeam(kick.team)}`;
}

export function buildPenaltyShootoutEmbed(
  match: WorldCupMatch,
  options: { finished?: boolean } = {},
): EmbedBuilder {
  const regulation = getDisplayedScore(match);
  const penalties = getPenaltyShootoutTally(match);
  const context = formatMatchContext(match);
  const header = options.finished ? 'Full Time · Penalties' : 'Penalty Shootout';
  const kickLines = (match.shootoutKicks ?? []).map(formatShootoutKickLine);
  const regulationLine = regulation
    ? `${formatMatchScoreTitle(match, regulation)} · Pens **${penalties.home}–${penalties.away}**`
    : `Pens **${penalties.home}–${penalties.away}**`;
  const descriptionParts = [
    context ? `${header} · ${context}` : header,
    '',
    regulationLine,
  ];
  if (kickLines.length > 0) {
    descriptionParts.push('', ...kickLines);
  }
  return new EmbedBuilder()
    .setTitle(`⚽ ${formatMatchTeams(match)}`)
    .setDescription(descriptionParts.join('\n'))
    .setColor(options.finished ? 0x228B22 : 0xFFD700);
}

export function announcedGoalCount(state: FootballMatchAnnouncementState | null): number {
  return (state?.lastHomeScore ?? 0) + (state?.lastAwayScore ?? 0);
}

export function getNewGoalEvents(
  match: WorldCupMatch,
  state: FootballMatchAnnouncementState | null,
): GoalEvent[] {
  return getGoalEvents(match).slice(announcedGoalCount(state));
}

/** @deprecated Use getGoalEvents instead */
export function getScoreProgression(match: WorldCupMatch): { home: number; away: number }[] {
  return getGoalEvents(match).map((goal) => ({ home: goal.home, away: goal.away }));
}

export function buildReplayEmbedsForMatch(match: WorldCupMatch): EmbedBuilder[] {
  const kickoff = parseKickoffUtc(match);
  if (!kickoff) return [];

  const embeds: EmbedBuilder[] = [buildPreMatchEmbed(match, kickoff)];

  for (const goal of getGoalEvents(match)) {
    embeds.push(buildGoalEmbed(match, goal));
  }

  if (isFinished(match)) {
    const finalScore = getDisplayedScore(match);
    if (match.score?.penalty) {
      embeds.push(buildPenaltyShootoutEmbed(match, { finished: true }));
    } else if (finalScore) {
      embeds.push(buildFullTimeEmbed(match, finalScore));
    }
  } else {
    const liveScore = getDisplayedScore(match);
    if (liveScore && (liveScore.home > 0 || liveScore.away > 0) && getGoalEvents(match).length === 0) {
      embeds.push(buildScoreUpdateEmbed(match, liveScore));
    }
  }

  return embeds;
}

export const DEFAULT_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function formatReplayWindow(hours: number): string {
  return `the last ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function replayWindowMsFromHours(hours: number | null | undefined): number {
  if (hours == null) return DEFAULT_REPLAY_WINDOW_MS;
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) {
    throw new Error('hours must be between 1 and 720');
  }
  return hours * 60 * 60 * 1000;
}

export function getMatchesForReplay(
  matches: WorldCupMatch[],
  now: number,
  windowMs = DEFAULT_REPLAY_WINDOW_MS,
): WorldCupMatch[] {
  return matches
    .filter((match) => {
      const kickoff = parseKickoffUtc(match);
      if (!kickoff) return false;
      const kickoffMs = kickoff.getTime();
      if (kickoffMs > now + PRE_MATCH_LEAD_MS) return false;
      return kickoffMs >= now - windowMs;
    })
    .sort((a, b) => (parseKickoffUtc(a)?.getTime() ?? 0) - (parseKickoffUtc(b)?.getTime() ?? 0));
}
