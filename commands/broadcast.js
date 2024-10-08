require('dotenv').config();
const { CommandInteraction, TextChannel } = require('discord.js');
const { DevCommand } = require("./classes/devcommand.js");
const { EmbedBuilder } = require('discord.js');

class BroadcastCommand extends DevCommand {
    constructor(client) {
        super(client, "broadcast", "Send a message to multiple channels by their IDs", [
            {
                name: 'channels',
                description: 'Comma-separated list of channel IDs',
                type: 3, // string
                required: true
            },
            {
                name: 'message',
                description: 'The message to broadcast to the channels',
                type: 3, // string
                required: true
            }
        ]);
    }

    async execute(interaction) {
        const channelIdsInput = interaction.options.getString('channels');
        const message = interaction.options.getString('message');
        const channelIds = channelIdsInput.split(',').map(id => id.trim());

        // Loop through each channel ID and send the message
        let successCount = 0;
        let failedChannels = [];

        for (const channelId of channelIds) {
            try {
                const channel = await interaction.client.channels.fetch(channelId);

                // Check if it's a valid TextChannel
                if (channel instanceof TextChannel) {
                    await channel.send(message);
                    successCount++;
                } else {
                    failedChannels.push(channelId);
                }
            } catch (error) {
                console.error(`Failed to send message to channel ${channelId}: ${error}`);
                failedChannels.push(channelId);
            }
        }

        // Create the response message
        const embed = new EmbedBuilder()
            .setTitle('Broadcast Results')
            .setColor(0x00FF00)
            .setDescription(`Successfully sent message to ${successCount} channels.`);

        if (failedChannels.length > 0) {
            embed.addFields({ 
                name: 'Failed Channels', 
                value: failedChannels.join(', ') 
            });
        }

        // Respond to the command
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = BroadcastCommand;
