import { DevCommand } from './classes/DevCommand';
import { logError } from '../utils/log';
import { getFootballChannelIds } from '../utils/footballChannels';
import {
  buildReplayEmbedsForMatch,
  formatReplayWindow,
  getMatchesForReplay,
  replayWindowMsFromHours,
} from '../utils/footballAnnouncements';
import { fetchWorldCupMatches } from '../utils/worldcup';

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
      let embedCount = 0;
      const failedChannels = new Set<string>();

      for (const match of recentMatches) {
        const embeds = buildReplayEmbedsForMatch(match);
        for (const embed of embeds) {
          for (const channelId of channelIds) {
            try {
              const channel = this.client.channels.cache.get(channelId)
                ?? await this.client.channels.fetch(channelId);
              if (!channel?.isTextBased()) {
                failedChannels.add(channelId);
                continue;
              }
              await channel.send({ embeds: [embed] });
              embedCount += 1;
            } catch (error) {
              logError(`Football test failed for channel ${channelId}:`, error);
              failedChannels.add(channelId);
            }
          }
        }
      }

      let resultMessage = `Replayed **${embedCount}** announcement${embedCount === 1 ? '' : 's'} `
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
}

export default FootballTest;
