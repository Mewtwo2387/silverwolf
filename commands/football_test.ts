import { DevCommand } from './classes/DevCommand';
import { logError } from '../utils/log';
import { getFootballChannelIds } from '../utils/footballChannels';
import {
  buildFullTimeEmbed,
  buildPreMatchEmbed,
  buildScoreUpdateEmbed,
  formatReplayWindow,
  getGoalEvents,
  getMatchesForReplay,
  replayWindowMsFromHours,
} from '../utils/footballAnnouncements';
import { broadcastGoalAnnouncement } from '../utils/footballBroadcast';
import { getGoalFollowUpContent } from '../utils/footballEasterEggs';
import {
  fetchWorldCupMatches,
  getDisplayedScore,
  isFinished,
  parseKickoffUtc,
} from '../utils/worldcup';

class FootballTest extends DevCommand {
  constructor(client: any) {
    super(client, 'test', 'Replay football announcements for recent matches', [
      {
        name: 'hours',
        description: 'How many hours back to replay (default: 24, max: 720)',
        type: 4,
        required: false,
        min_value: 1,
        max_value: 720,
      },
    ], {
      isSubcommandOf: 'football',
      blame: 'xei',
      ephemeral: true,
    });
  }

  async run(interaction: any): Promise<void> {
    const channelIds = await getFootballChannelIds(this.client.db);
    if (channelIds.length === 0) {
      await interaction.editReply(
        'No football channels configured. Use `/football channel` or set `FOOTBALL_CHANNELS` in the environment.',
      );
      return;
    }

    const hours = interaction.options.getInteger('hours');

    let windowMs: number;
    try {
      windowMs = replayWindowMsFromHours(hours);
    } catch {
      await interaction.editReply('Invalid hours value. Must be a whole number from 1 to 720.');
      return;
    }

    const windowLabel = formatReplayWindow(hours ?? 24);

    try {
      const matches = await fetchWorldCupMatches();
      const recentMatches = getMatchesForReplay(matches, Date.now(), windowMs);
      let messageCount = 0;
      const failedChannels = new Set<string>();

      for (const match of recentMatches) {
        const kickoff = parseKickoffUtc(match);
        if (kickoff) {
          messageCount += await this.broadcastEmbed(channelIds, failedChannels, buildPreMatchEmbed(match, kickoff));
        }

        for (const goal of getGoalEvents(match)) {
          for (const channelId of channelIds) {
            const ok = await broadcastGoalAnnouncement(this.client, channelId, match, goal);
            if (ok) messageCount += 1 + getGoalFollowUpContent(goal).length;
            else failedChannels.add(channelId);
          }
        }

        if (isFinished(match)) {
          const finalScore = getDisplayedScore(match);
          if (finalScore) {
            messageCount += await this.broadcastEmbed(
              channelIds,
              failedChannels,
              buildFullTimeEmbed(match, finalScore),
            );
          }
        } else {
          const liveScore = getDisplayedScore(match);
          if (liveScore && (liveScore.home > 0 || liveScore.away > 0) && getGoalEvents(match).length === 0) {
            messageCount += await this.broadcastEmbed(
              channelIds,
              failedChannels,
              buildScoreUpdateEmbed(match, liveScore),
            );
          }
        }
      }

      let resultMessage = `Replayed **${messageCount}** message${messageCount === 1 ? '' : 's'} `
        + `across **${recentMatches.length}** match${recentMatches.length === 1 ? '' : 'es'} from ${windowLabel}.`;

      if (recentMatches.length === 0) {
        resultMessage = `No matches found for ${windowLabel} — nothing to replay.`;
      }

      if (failedChannels.size > 0) {
        resultMessage += `\n\n❌ Failed to reach: ${[...failedChannels].join(', ')}`;
      }

      await interaction.editReply({ content: resultMessage });
    } catch (error) {
      logError('Football test command failed:', error);
      await interaction.editReply('Failed to replay football announcements. Please try again later.');
    }
  }

  private async broadcastEmbed(
    channelIds: string[],
    failedChannels: Set<string>,
    embed: ReturnType<typeof buildPreMatchEmbed>,
  ): Promise<number> {
    let sent = 0;
    for (const channelId of channelIds) {
      try {
        const channel = this.client.channels.cache.get(channelId)
          ?? await this.client.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          failedChannels.add(channelId);
          continue;
        }
        await channel.send({ embeds: [embed] });
        sent += 1;
      } catch (error) {
        logError(`Football test failed for channel ${channelId}:`, error);
        failedChannels.add(channelId);
      }
    }
    return sent;
  }
}

export default FootballTest;
