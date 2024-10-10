const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

class NuggieBoard extends Command {
    constructor(client) {
        super(client, "nuggieboard", "dinonuggie leaderboard", []);
        this.itemsPerPage = 10;  // Show 10 items per page
    }

    async run(interaction) {
        try {
            // Get initial data for the first page
            let currentPage = 0;
            const nuggies = await this.client.db.getEveryoneAttr('dinonuggies', this.itemsPerPage, currentPage * this.itemsPerPage);
            
            // Generate the leaderboard content for the first page
            const totalCount = await this.client.db.getEveryoneAttrCount('dinonuggies'); // New method to count total rows
            const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;
            const leaderboard = await this.generateLeaderboard(nuggies, currentPage);

            // Create pagination buttons
            const row = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('⬅️ Back')
                        .setStyle(Discord.ButtonStyle.Primary)
                        .setDisabled(true), // Disable at first page
                    new Discord.ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ➡️')
                        .setStyle(Discord.ButtonStyle.Primary)
                        .setDisabled(currentPage === maxPage) // Disable if no more pages
                );

            // Send the initial message
            const message = await interaction.editReply({
                embeds: [leaderboard],
                components: [row]
            });

            // Handle button interactions for pagination
            const collector = message.createMessageComponentCollector({ time: 60000 }); // 1 minute timeout

            collector.on('collect', async i => {
                if (i.customId === 'prev_page' && currentPage > 0) {
                    currentPage--;
                } else if (i.customId === 'next_page' && currentPage < maxPage) {
                    currentPage++;
                }

                // Fetch new data for the updated page
                const newNuggies = await this.client.db.getEveryoneAttr('dinonuggies', this.itemsPerPage, currentPage * this.itemsPerPage);
                const newLeaderboard = await this.generateLeaderboard(newNuggies, currentPage);

                // Update the buttons
                const newRow = new Discord.ActionRowBuilder()
                    .addComponents(
                        new Discord.ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('⬅️ Back')
                            .setStyle(Discord.ButtonStyle.Primary)
                            .setDisabled(currentPage === 0), // Disable at first page
                        new Discord.ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next ➡️')
                            .setStyle(Discord.ButtonStyle.Primary)
                            .setDisabled(currentPage === maxPage) // Disable at last page
                    );

                // Update the message
                await i.update({ embeds: [newLeaderboard], components: [newRow] });
            });

            collector.on('end', async () => {
                // Disable the buttons when the collector times out
                const disabledRow = new Discord.ActionRowBuilder()
                    .addComponents(
                        new Discord.ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('⬅️ Back')
                            .setStyle(Discord.ButtonStyle.Primary)
                            .setDisabled(true),
                        new Discord.ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next ➡️')
                            .setStyle(Discord.ButtonStyle.Primary)
                            .setDisabled(true)
                    );
                await message.edit({ components: [disabledRow] });
            });

        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            await interaction.editReply({ content: 'Failed to retrieve leaderboard', ephemeral: true });
        }
    }

    // Helper function to generate the leaderboard embed
    async generateLeaderboard(nuggies, page) {
        let result = "";
        for (let i = 0; i < nuggies.length; i++) {
            result += `${i + 1 + (page * this.itemsPerPage)}. <@${nuggies[i].id}>: ${format(nuggies[i].dinonuggies)}\n`;
        }

        return new Discord.EmbedBuilder()
            .setTitle("Dinonuggie Leaderboard")
            .setDescription(result)
            .setFooter({ text: `Page ${page + 1}` });
    }
}

module.exports = NuggieBoard;