import { TextChannel, EmbedBuilder } from 'discord.js';
import { AdminCommand } from './classes/AdminCommand';
import { logError } from '../utils/log';

class Say extends AdminCommand {
  constructor(client: any) {
    super(client, 'say', 'Send a message to one or more channels', [
      {
        name: 'message',
        description: 'The message to send, use \\n for newlines',
        type: 3,
        required: true,
      },
      {
        name: 'channels',
        description: 'Comma-separated list of channel mentions (e.g., <#12345>,<#67890>)',
        type: 3,
        required: false,
      },
      {
        name: 'attachment',
        description: 'Optional attachment to send with the message',
        type: 11,
        required: false,
      },
    ], { ephemeral: true, blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const input = interaction.options.getString('message')
      .replace(/@/g, '')
      .replace(/\\n/g, '\n');
    const attachment = interaction.options.getAttachment('attachment');
    const channelsInput = interaction.options.getString('channels');

    const targetChannels: TextChannel[] = [];
    if (channelsInput) {
      const channelMentions = channelsInput.split(',').map((id: string) => id.trim());
      channelMentions.forEach(async (mention: string) => {
        const channelId = mention.match(/^<#(\d+)>$/)?.[1];
        if (channelId) {
          try {
            const channel = await interaction.client.channels.fetch(channelId);
            if (channel instanceof TextChannel) {
              targetChannels.push(channel);
            }
          } catch (error) {
            logError(`Failed to fetch channel ${channelId}:`, error);
          }
        }
      });
    }

    if (targetChannels.length === 0) {
      targetChannels.push(interaction.channel);
    }

    const messageOptions = {
      content: input,
      files: attachment ? [attachment.url] : [],
    };

    let successCount = 0;
    const failedChannels: string[] = [];
    targetChannels.forEach(async (channel) => {
      try {
        await channel.send(messageOptions);
        successCount += 1;
      } catch (error) {
        logError(`Failed to send message to channel ${channel.id}:`, error);
        failedChannels.push(`<#${channel.id}>`);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle('Message Sending Results')
      .setColor(0x00FF00)
      .setDescription(`Message sent to ${successCount} channels.`);

    const successfulChannelMentions = targetChannels
      .filter((channel) => !failedChannels.includes(`<#${channel.id}>`))
      .map((channel) => `<#${channel.id}>`);

    if (successfulChannelMentions.length > 0) {
      embed.addFields({
        name: 'Successful Channels',
        value: successfulChannelMentions.join(', '),
      });
    }

    if (failedChannels.length > 0) {
      embed.addFields({
        name: 'Failed Channels',
        value: failedChannels.join(', '),
      });
    }

    await interaction.editReply({ embeds: [embed], ephemeral: true });
  }
}

export default Say;
