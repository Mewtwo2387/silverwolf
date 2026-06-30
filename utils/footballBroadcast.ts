import { logError } from './log';
import { buildGoalEmbed, buildPenaltyShootoutEmbed, type GoalEvent } from './footballAnnouncements';
import { getGoalFollowUpContent } from './footballEasterEggs';
import type { WorldCupMatch } from './worldcup';

type TextChannelLike = {
  isTextBased: () => boolean;
  send: (payload: { embeds?: unknown[]; content?: string }) => Promise<{ id: string }>;
  messages: {
    fetch: (id: string) => Promise<{ edit: (payload: { embeds?: unknown[] }) => Promise<unknown> }>;
  };
};

type ChannelClient = {
  channels: {
    cache: { get: (id: string) => unknown };
    fetch: (id: string) => Promise<unknown>;
  };
};

async function getTextChannel(client: ChannelClient, channelId: string): Promise<TextChannelLike | null> {
  const channel = client.channels.cache.get(channelId.trim()) as TextChannelLike | undefined
    ?? await client.channels.fetch(channelId.trim()).catch(() => null) as TextChannelLike | null;
  if (!channel?.isTextBased()) {
    logError(`Football channel ${channelId} is invalid or not text-based.`);
    return null;
  }
  return channel;
}

export async function broadcastGoalAnnouncement(
  client: ChannelClient,
  channelId: string,
  match: WorldCupMatch,
  goal: GoalEvent,
): Promise<boolean> {
  try {
    const channel = await getTextChannel(client, channelId);
    if (!channel) return false;

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

export async function upsertPenaltyShootoutEmbed(
  client: ChannelClient,
  channelId: string,
  match: WorldCupMatch,
  messageId: string | null,
  finished: boolean,
): Promise<string | null> {
  try {
    const channel = await getTextChannel(client, channelId);
    if (!channel) return null;

    const embed = buildPenaltyShootoutEmbed(match, { finished });
    if (messageId) {
      try {
        const message = await channel.messages.fetch(messageId);
        await message.edit({ embeds: [embed] });
        return messageId;
      } catch {
        // Message deleted or inaccessible — fall through to a new send.
      }
    }

    const sent = await channel.send({ embeds: [embed] });
    return sent.id;
  } catch (error) {
    logError(`Error updating football penalty shootout embed in channel ${channelId}:`, error);
    return messageId;
  }
}
