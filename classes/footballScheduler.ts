import { EmbedBuilder } from 'discord.js';
import { log, logError } from '../utils/log';
import { getFootballChannelIds } from '../utils/footballChannels';
import {
  buildFullTimeEmbed,
  buildPreMatchEmbed,
  buildScoreUpdateEmbed,
} from '../utils/footballAnnouncements';
import {
  fetchWorldCupMatches,
  getDisplayedScore,
  isFinished,
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

  constructor(client: any) {
    this.client = client;
  }

  start(): void {
    this.minuteJob = (Bun.cron as any)('* * * * *', async () => {
      await this.checkMatches();
    });
  }

  stop(): void {
    this.minuteJob?.stop();
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
      await this.client.db.footballMatchAnnouncement.seedBaseline(
        id,
        score?.home ?? null,
        score?.away ?? null,
        finished,
      );
      state = await this.client.db.footballMatchAnnouncement.getState(id);
      return;
    }

    if (!finished && now < kickoffMs - PRE_MATCH_LEAD_MS) return;
    if (!finished && now > kickoffMs + MATCH_WINDOW_MS) return;
    if (finished && state?.fullTimeSent) return;

    if (!state?.preMatchSent && now >= kickoffMs - PRE_MATCH_LEAD_MS && now < kickoffMs) {
      await this.announcePreMatch(match, kickoff, channelIds);
      await this.client.db.footballMatchAnnouncement.markPreMatchSent(id);
    }

    if (score && this.shouldAnnounceScore(score, state, finished)) {
      if (finished && !state?.fullTimeSent) {
        await this.announceFullTime(match, score, channelIds);
        await this.client.db.footballMatchAnnouncement.markFullTimeSent(id, score.home, score.away);
      } else if (!finished && now >= kickoffMs && now <= kickoffMs + MATCH_WINDOW_MS) {
        await this.announceScoreUpdate(match, score, channelIds);
        await this.client.db.footballMatchAnnouncement.markScoreAnnounced(id, score.home, score.away);
      }
    }
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
  ): Promise<void> {
    await this.broadcast(channelIds, { embeds: [buildScoreUpdateEmbed(match, score)] });
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
