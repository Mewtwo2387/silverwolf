import { logError } from './log';
import { buildGoalEmbed, type GoalEvent } from './footballAnnouncements';
import { getGoalFollowUpContent } from './footballEasterEggs';
import type { WorldCupMatch } from './worldcup';

type TextChannelLike = {
  isTextBased: () => boolean;
  send: (payload: { embeds?: unknown[]; content?: string }) => Promise<unknown>;
};

type ChannelClient = {
  channels: {
    cache: { get: (id: string) => unknown };
    fetch: (id: string) => Promise<unknown>;
  };
};

export async function broadcastGoalAnnouncement(
  client: ChannelClient,
  channelId: string,
  match: WorldCupMatch,
  goal: GoalEvent,
): Promise<boolean> {
  try {
    const channel = client.channels.cache.get(channelId.trim()) as TextChannelLike | undefined
      ?? await client.channels.fetch(channelId.trim()).catch(() => null) as TextChannelLike | null;
    if (!channel?.isTextBased()) {
      logError(`Football channel ${channelId} is invalid or not text-based.`);
      return false;
    }

    await channel.send({ embeds: [buildGoalEmbed(match, goal)] });
    for (const content of getGoalFollowUpContent(goal)) {
      await channel.send({ content });
    }
    return true;
  } catch (error) {
    logError(`Error sending football goal announcement to channel ${channelId}:`, error);
    return false;
  }
}
