import { EmbedBuilder } from 'discord.js';
import { log, logError } from '../utils/log';
import { getFootballChannelIds } from '../utils/footballChannels';
import {
  buildFullTimeEmbed,
  buildPreMatchEmbed,
  buildScoreUpdateEmbed,
  announcedGoalCount,
  getGoalEvents,
  getNewGoalEvents,
} from '../utils/footballAnnouncements';
import { broadcastGoalAnnouncement, upsertPenaltyShootoutEmbed } from '../utils/footballBroadcast';
import {
  fetchWorldCupMatches,
  getDisplayedScore,
  getPenaltyShootoutTally,
  isFinished,
  isLiveMatch,
  isPenaltyShootout,
  isPenaltyShootoutPhase,
  matchId,
  MATCH_WINDOW_MS,
  needsAnnouncementBaseline,
  parseKickoffUtc,
  PRE_MATCH_LEAD_MS,
  type WorldCupMatch,
} from '../utils/worldcup';
import type { FootballMatchAnnouncementState } from '../database/models/FootballMatchAnnouncementModel';

class FootballScheduler {
  client: any;
  private minuteJob: BunCronJob | null = null;
  private isRunning = false;

  constructor(client: any) {
    this.client = client;
  }

  start(): void {
    if (this.minuteJob) return;

    this.minuteJob = (Bun.cron as any)('* * * * *', async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.checkMatches();
      } finally {
        this.isRunning = false;
      }
    });
  }

  stop(): void {
    this.minuteJob?.stop();
    this.minuteJob = null;
  }

  async checkMatches(): Promise<void> {
    try {
      const channelIds = await getFootballChannelIds(this.client.db);
      if (channelIds.length === 0) return;

      const matches = await fetchWorldCupMatches();
      const now = Date.now();

      for (const match of matches) {
        await this.processMatch(match, channelIds, now);
      }
    } catch (error) {
      logError('Football scheduler check failed:', error);
    }
  }

  private async processMatch(match: WorldCupMatch, channelIds: string[], now: number): Promise<void> {
    const kickoff = parseKickoffUtc(match);
    if (!kickoff) {
      logError(`Could not parse kickoff time for ${match.team1} vs ${match.team2}: ${match.time}`);
      return;
    }

    const kickoffMs = kickoff.getTime();
    const id = matchId(match);
    let state = await this.client.db.footballMatchAnnouncement.getState(id);
    const finished = isFinished(match);
    const score = getDisplayedScore(match);

    if (needsAnnouncementBaseline(Boolean(state), kickoffMs, now)) {
      if (isPenaltyShootoutPhase(match)) {
        const pen = getPenaltyShootoutTally(match);
        const kickCount = match.shootoutKicks?.length ?? 0;
        if (finished) {
          await this.client.db.footballMatchAnnouncement.markShootoutFinished(
            id, kickCount, {}, pen.home, pen.away,
          );
        } else {
          await this.client.db.footballMatchAnnouncement.markShootoutSynced(
            id, kickCount, {}, pen.home, pen.away,
          );
        }
      } else {
        const goalCount = (match.goals1?.length ?? 0) + (match.goals2?.length ?? 0);
        await this.client.db.footballMatchAnnouncement.seedBaseline(
          id,
          score?.home ?? null,
          score?.away ?? null,
          finished,
          goalCount,
        );
      }
      return;
    }

    if (!finished && !isPenaltyShootout(match) && now < kickoffMs - PRE_MATCH_LEAD_MS) return;
    if (!finished && !isPenaltyShootout(match) && now > kickoffMs + MATCH_WINDOW_MS) return;
    if (state?.fullTimeSent) return;

    if (!state?.preMatchSent && now >= kickoffMs - PRE_MATCH_LEAD_MS && now < kickoffMs) {
      await this.announcePreMatch(match, kickoff, channelIds);
      await this.client.db.footballMatchAnnouncement.markPreMatchSent(id);
      state = await this.client.db.footballMatchAnnouncement.getState(id);
    }

    const inLiveWindow = now >= kickoffMs && now <= kickoffMs + MATCH_WINDOW_MS;

    if (isPenaltyShootoutPhase(match)) {
      await this.syncPenaltyShootout(match, id, channelIds, state, finished);
      return;
    }

    state = await this.announcePendingGoals(match, id, channelIds, state, finished ? true : inLiveWindow);

    if (finished && !state?.fullTimeSent && score) {
      const goalCount = getGoalEvents(match).length;
      await this.announceFullTime(match, score, channelIds);
      await this.client.db.footballMatchAnnouncement.markFullTimeSent(
        id, score.home, score.away, goalCount,
      );
    } else if (
      !finished
      && !isLiveMatch(match)
      && inLiveWindow
      && score
      && getGoalEvents(match).length === 0
      && getNewGoalEvents(match, state).length === 0
      && this.shouldAnnounceScore(score, state, false)
    ) {
      await this.announceScoreUpdate(match, score, channelIds, state);
      await this.client.db.footballMatchAnnouncement.markScoreAnnounced(id, score.home, score.away);
    }
  }

  private async announcePendingGoals(
    match: WorldCupMatch,
    id: string,
    channelIds: string[],
    state: FootballMatchAnnouncementState | null,
    allowAnnounce: boolean,
  ): Promise<FootballMatchAnnouncementState | null> {
    if (!allowAnnounce) return state;

    let currentState = state;
    let announcedGoals = announcedGoalCount(currentState);
    for (const goal of getNewGoalEvents(match, currentState)) {
      for (const channelId of channelIds) {
        await broadcastGoalAnnouncement(this.client, channelId, match, goal);
      }
      announcedGoals += 1;
      await this.client.db.footballMatchAnnouncement.markGoalAnnounced(
        id,
        goal.home,
        goal.away,
        announcedGoals,
      );
      currentState = await this.client.db.footballMatchAnnouncement.getState(id);
    }
    return currentState;
  }

  private async syncPenaltyShootout(
    match: WorldCupMatch,
    id: string,
    channelIds: string[],
    state: FootballMatchAnnouncementState | null,
    finished: boolean,
  ): Promise<void> {
    const kickCount = match.shootoutKicks?.length ?? 0;
    const pen = getPenaltyShootoutTally(match);
    const lastKickCount = state?.lastShootoutKickCount ?? 0;
    const messageIds = { ...(state?.shootoutMessageIds ?? {}) };
    const hasMessages = Object.keys(messageIds).length > 0;
    const needsUpdate = kickCount !== lastKickCount
      || (finished && !state?.fullTimeSent)
      || (!hasMessages && isPenaltyShootout(match));

    if (!needsUpdate) return;

    for (const channelId of channelIds) {
      const updatedId = await upsertPenaltyShootoutEmbed(
        this.client,
        channelId,
        match,
        messageIds[channelId] ?? null,
        finished,
      );
      if (updatedId) messageIds[channelId] = updatedId;
    }

    if (finished) {
      await this.client.db.footballMatchAnnouncement.markShootoutFinished(
        id, kickCount, messageIds, pen.home, pen.away,
      );
      log(
        `Football penalties finished: ${match.team1} ${match.score?.ft?.[0] ?? 0}-`
        + `${match.score?.ft?.[1] ?? 0} ${match.team2} (${pen.home}-${pen.away} pens)`,
      );
      return;
    }

    await this.client.db.footballMatchAnnouncement.markShootoutSynced(
      id, kickCount, messageIds, pen.home, pen.away,
    );
    log(`Football penalty shootout update: ${match.team1} ${pen.home}-${pen.away} ${match.team2}`);
  }

  private shouldAnnounceScore(
    score: { home: number; away: number },
    state: FootballMatchAnnouncementState | null,
    finished: boolean,
  ): boolean {
    if (finished) return !state?.fullTimeSent;
    if (state?.lastHomeScore === score.home && state?.lastAwayScore === score.away) return false;
    return score.home > 0 || score.away > 0;
  }

  private async announcePreMatch(match: WorldCupMatch, kickoff: Date, channelIds: string[]): Promise<void> {
    await this.broadcast(channelIds, { embeds: [buildPreMatchEmbed(match, kickoff)] });
    log(`Football pre-match announcement: ${match.team1} vs ${match.team2}`);
  }

  private async announceScoreUpdate(
    match: WorldCupMatch,
    score: { home: number; away: number },
    channelIds: string[],
    state: FootballMatchAnnouncementState | null,
  ): Promise<void> {
    const prevScore = {
      home: state?.lastHomeScore ?? 0,
      away: state?.lastAwayScore ?? 0,
    };
    await this.broadcast(channelIds, { embeds: [buildScoreUpdateEmbed(match, score, prevScore)] });
    log(`Football score update: ${match.team1} ${score.home}-${score.away} ${match.team2}`);
  }

  private async announceFullTime(
    match: WorldCupMatch,
    score: { home: number; away: number },
    channelIds: string[],
  ): Promise<void> {
    await this.broadcast(channelIds, { embeds: [buildFullTimeEmbed(match, score)] });
    log(`Football full-time announcement: ${match.team1} ${score.home}-${score.away} ${match.team2}`);
  }

  private async broadcast(channelIds: string[], payload: { embeds: EmbedBuilder[] }): Promise<void> {
    for (const channelId of channelIds) {
      try {
        const channel = this.client.channels.cache.get(channelId.trim())
          ?? await this.client.channels.fetch(channelId.trim()).catch(() => null);
        if (!channel?.isTextBased()) {
          logError(`Football channel ${channelId} is invalid or not text-based.`);
          continue;
        }
        await channel.send(payload);
      } catch (error) {
        logError(`Error sending football announcement to channel ${channelId}:`, error);
      }
    }
  }
}

export default FootballScheduler;
