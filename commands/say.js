const { AdminCommand } = require("./classes/admincommand.js");
const { TextChannel, EmbedBuilder } = require('discord.js');
const { logError } = require('../utils/log');

class Say extends AdminCommand {
    constructor(client) {
        super(client, "say", "Send a message to one or more channels", [
            {
                name: 'message',
                description: 'The message to send, use \\n for newlines',
                type: 3, // STRING type
                required: true
            },
            {
                name: 'channels',
                description: 'Comma-separated list of channel mentions (e.g., <#12345>,<#67890>)',
                type: 3, // STRING type
                required: false
            },
            {
                name: 'attachment',
                description: 'Optional attachment to send with the message',
                type: 11, // ATTACHMENT type
                required: false
            }
        ], {ephemeral: true});
    }

    async run(interaction) {
        // Get message content and replace @ symbols and \n
        const input = interaction.options.getString('message')
            .replace(/@/g, '')    // Prevent mentions
            .replace(/\\n/g, '\n'); // Convert \n to actual newlines
        const attachment = interaction.options.getAttachment('attachment');
        const channelsInput = interaction.options.getString('channels');

        // Determine target channels
        const targetChannels = [];
        if (channelsInput) {
            const channelMentions = channelsInput.split(',').map(id => id.trim());
            for (const mention of channelMentions) {
                const channelId = mention.match(/^<#(\d+)>$/)?.[1];
                if (channelId) {
                    try {
                        const channel = await interaction.client.channels.fetch(channelId);
                        if (channel instanceof TextChannel) {
                            targetChannels.push(channel);
                        }
                    } catch (error) {
                        logError(`Failed to fetch channel ${channelId}: ${error}`);
                    }
                }
            }
        }

        // If no valid target channels found, fallback to the command's current channel
        if (targetChannels.length === 0) {
            targetChannels.push(interaction.channel);
        }

        // Create message options
        const messageOptions = {
            content: input,
            files: attachment ? [attachment.url] : [] // Add the attachment if it exists
        };

        // Send the message to all target channels
        let successCount = 0;
        let failedChannels = [];
        for (const channel of targetChannels) {
            try {
                await channel.send(messageOptions);
                successCount++;
            } catch (error) {
                logError(`Failed to send message to channel ${channel.id}: ${error}`);
                failedChannels.push(`<#${channel.id}>`);
            }
        }

        // Create response message
        const embed = new EmbedBuilder()
            .setTitle('Message Sending Results')
            .setColor(0x00FF00)
            .setDescription(`Message sent to ${successCount} channels.`);

        // Collect the mentions of successfully sent channels
        const successfulChannelMentions = targetChannels
            .filter(channel => !failedChannels.includes(`<#${channel.id}>`))
            .map(channel => `<#${channel.id}>`);

        // Add successfully sent channel mentions to the embed
        if (successfulChannelMentions.length > 0) {
            embed.addFields({
                name: 'Successful Channels',
                value: successfulChannelMentions.join(', ')
            });
        }

        // Add failed channels to the embed, if there are any
        if (failedChannels.length > 0) {
            embed.addFields({
                name: 'Failed Channels',
                value: failedChannels.join(', ')
            });
        }

        // Send an ephemeral reply indicating the result
        await interaction.editReply({ embeds: [embed], ephemeral: true });

    }
}

module.exports = Say;