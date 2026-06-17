import { EmbedBuilder } from 'discord.js';
import {
  formatMatchContext,
  formatMatchScoreTitle,
  formatMatchTeams,
  getDisplayedScore,
  isFinished,
  parseKickoffUtc,
  PRE_MATCH_LEAD_MS,
  type WorldCupMatch,
} from './worldcup';

export function buildPreMatchEmbed(match: WorldCupMatch, kickoff: Date): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(`⚽ ${formatMatchTeams(match)}`)
    .setDescription(
      `${context ? `${context}\n` : ''}Kickoff in **5 minutes** (<t:${Math.floor(kickoff.getTime() / 1000)}:R>).`,
    )
    .setColor(0x1E90FF);
}

export function buildScoreUpdateEmbed(
  match: WorldCupMatch,
  score: { home: number; away: number },
): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(formatMatchScoreTitle(match, score))
    .setDescription(context || 'Live score')
    .setColor(0xFFD700);
}

export function buildFullTimeEmbed(
  match: WorldCupMatch,
  score: { home: number; away: number },
): EmbedBuilder {
  const context = formatMatchContext(match);
  return new EmbedBuilder()
    .setTitle(formatMatchScoreTitle(match, score))
    .setDescription(context ? `Full Time · ${context}` : 'Full Time')
    .setColor(0x228B22);
}

function parseGoalMinute(minute: string): number {
  const parsed = minute.match(/^(\d+)(?:\+(\d+))?$/);
  if (!parsed) return 999;
  return Number(parsed[1]) + Number(parsed[2] ?? 0);
}

export function getScoreProgression(match: WorldCupMatch): { home: number; away: number }[] {
  const events = [
    ...(match.goals1 ?? []).map((goal) => ({ side: 1 as const, minute: parseGoalMinute(goal.minute) })),
    ...(match.goals2 ?? []).map((goal) => ({ side: 2 as const, minute: parseGoalMinute(goal.minute) })),
  ].sort((a, b) => a.minute - b.minute);

  let home = 0;
  let away = 0;
  const progression: { home: number; away: number }[] = [];
  for (const event of events) {
    if (event.side === 1) home += 1;
    else away += 1;
    progression.push({ home, away });
  }
  return progression;
}

export function buildReplayEmbedsForMatch(match: WorldCupMatch): EmbedBuilder[] {
  const kickoff = parseKickoffUtc(match);
  if (!kickoff) return [];

  const embeds: EmbedBuilder[] = [buildPreMatchEmbed(match, kickoff)];

  const progression = getScoreProgression(match);
  for (const score of progression) {
    embeds.push(buildScoreUpdateEmbed(match, score));
  }

  if (isFinished(match)) {
    const finalScore = getDisplayedScore(match);
    if (finalScore) embeds.push(buildFullTimeEmbed(match, finalScore));
  } else {
    const liveScore = getDisplayedScore(match);
    if (liveScore && (liveScore.home > 0 || liveScore.away > 0) && progression.length === 0) {
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
