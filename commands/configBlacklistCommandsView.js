const { DevCommand } = require('./classes/devcommand.js');
const Discord = require('discord.js');

class GetBlacklistedCommands extends DevCommand {
    constructor(client) {
        super(client, "getblacklistedcommands", "Retrieve blacklisted commands for a specific server", [
            {
                name: 'server',
                description: 'The ID of the server to retrieve blacklisted commands for',
                type: 3, // String type
                required: true
            }
        ]);
    }

    async run(interaction) {
        const serverId = interaction.options.getString('server');

        try {
            // Fetch blacklisted commands for the specified server
            const blacklistedCommands = await this.client.db.getBlacklistedCommands(serverId);
            
            // Check if there are any blacklisted commands
            if (blacklistedCommands.length === 0) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setColor('#00AA00')
                            .setTitle(`No Blacklisted Commands`)
                            .setDescription(`There are no blacklisted commands for server: **${serverId}**.`)
                    ]
                });
                return;
            }

            // Format the blacklisted commands for display
            const formattedCommands = blacklistedCommands.map((cmd, index) => 
                `**${index + 1}. Command**: ${cmd.command_name}\n**Reason**: ${cmd.reason || "No reason provided"}\n**Date Disabled**: ${cmd.disabled_date}`
            ).join("\n\n");

            // Send the list of blacklisted commands as a message
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`Blacklisted Commands for Server: ${serverId}`)
                        .setDescription(formattedCommands)
                ]
            });
        } catch (err) {
            console.error('Failed to retrieve blacklisted commands:', err);

            // Send an error message
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setColor('#AA0000')
                        .setTitle(`Failed to retrieve blacklisted commands`)
                        .setDescription(`An error occurred while retrieving blacklisted commands for server: **${serverId}**. Please try again.`)
                ]
            });
        }
    }
}

module.exports = GetBlacklistedCommands;
