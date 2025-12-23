// probably not needed
require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');

class BirthdayTest extends DevCommand {
  constructor(client) {
    super(client, 'test', 'Tests the birthday scheduler to ensure channels are accessible', [], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async execute(interaction) {
    const channelIds = process.env.BIRTHDAY_CHANNELS.split(',').map((id) => id.trim());
    const successChannels = [];
    const failedChannels = [];

    // Loop through all the channel IDs and attempt to send a message
    channelIds.forEach(async (channelId) => {
      const channel = this.client.channels.cache.get(channelId);
      if (channel) {
        try {
          const testEmbed = new EmbedBuilder()
            .setTitle('Test: Birthday Scheduler')
            .setDescription('This is a test to verify the birthday scheduler can send messages.')
            .setColor(0x00FF00);

          await channel.send({ embeds: [testEmbed] });
          successChannels.push(channelId); // Add to success list if the message was sent successfully
        } catch (error) {
          logError(`Error sending message to channel ${channelId}:`, error);
          failedChannels.push(channelId); // Add to failed list if there was an error
        }
      } else {
        logError(`Channel ID ${channelId} is invalid or not found.`);
        failedChannels.push(channelId); // Add to failed list if the channel is not found
      }
    });

    // Build the result message
    let resultMessage = 'Birthday Scheduler Channel Test Results:\n\n';
    if (successChannels.length > 0) {
      resultMessage += `✅ Successfully sent test messages to the following channels:\n${successChannels.join('\n')}\n\n`;
    }
    if (failedChannels.length > 0) {
      resultMessage += `❌ Failed to send messages to the following channels:\n${failedChannels.join('\n')}\n`;
    }

    // Reply to the interaction with the result
    await interaction.reply({ content: resultMessage, ephemeral: true });
  }
}

module.exports = BirthdayTest;
