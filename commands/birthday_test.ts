import { EmbedBuilder } from 'discord.js';
import { DevCommand } from './classes/DevCommand';
import { logError } from '../utils/log';
import { parseChannelIds } from '../utils/parseChannelIds';

class BirthdayTest extends DevCommand {
  constructor(client: any) {
    super(client, 'test', 'Tests the birthday scheduler to ensure channels are accessible', [], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async execute(interaction: any): Promise<void> {
    const dbChannels = await this.client.db.globalConfig.getGlobalConfig('birthday_channels');
    const channelIds = parseChannelIds(dbChannels ?? process.env.BIRTHDAY_CHANNELS);
    const successChannels: string[] = [];
    const failedChannels: string[] = [];

    for (const channelId of channelIds) {
      const channel = this.client.channels.cache.get(channelId);
      if (channel) {
        try {
          const testEmbed = new EmbedBuilder()
            .setTitle('Test: Birthday Scheduler')
            .setDescription('This is a test to verify the birthday scheduler can send messages.')
            .setColor(0x00FF00);

          await (channel as any).send({ embeds: [testEmbed] });
          successChannels.push(channelId);
        } catch (error) {
          logError(`Error sending message to channel ${channelId}:`, error);
          failedChannels.push(channelId);
        }
      } else {
        logError(`Channel ID ${channelId} is invalid or not found.`);
        failedChannels.push(channelId);
      }
    }

    let resultMessage = 'Birthday Scheduler Channel Test Results:\n\n';
    if (successChannels.length > 0) {
      resultMessage += `✅ Successfully sent test messages to the following channels:\n${successChannels.join('\n')}\n\n`;
    }
    if (failedChannels.length > 0) {
      resultMessage += `❌ Failed to send messages to the following channels:\n${failedChannels.join('\n')}\n`;
    }

    await interaction.reply({ content: resultMessage, ephemeral: true });
  }
}

export default BirthdayTest;
