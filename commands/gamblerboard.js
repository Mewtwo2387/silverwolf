const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

class GamblerBoard extends Command {
    constructor(client) {
        super(client, "gamblerboard", "gambler leaderboard", [
            {
                name: 'leaderboard',
                description: 'The leaderboard to display',
                type: 3,
                required: true,
                choices: [
                    { name: 'Slots', value: 'slots' },
                    { name: 'Roulette', value: 'roulette' },
                    { name: 'Blackjack', value: 'blackjack' },
                    { name: 'ALL', value: 'all' },
                ]
            }
        ]);
        this.itemsPerPage = 10;  // Show 10 items per page
    }

    async run(interaction) {
        try {
            // Get initial data for the first page
            let currentPage = 0;
            const leaderboardType = interaction.options.getString('leaderboard');
            let winnings;
            if (leaderboardType === 'all') {
                winnings = await this.client.db.getAllRelativeNetWinnings(this.itemsPerPage, currentPage * this.itemsPerPage);
            } else {
                winnings = await this.client.db.getRelativeNetWinnings(leaderboardType, this.itemsPerPage, currentPage * this.itemsPerPage);
            }
            
            // Generate the leaderboard content for the first page
            let totalCount;
            if (leaderboardType === 'all') {
                totalCount = await this.client.db.getAllRelativeNetWinningsCount();
            }else{
                totalCount = await this.client.db.getEveryoneAttrCount(`${leaderboardType}_times_played`);
            }
            const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;
            const leaderboard = await this.generateLeaderboard(winnings, currentPage, leaderboardType);

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
                let newWinnings;
                if (leaderboardType === 'all') {
                    newWinnings = await this.client.db.getAllRelativeNetWinnings(this.itemsPerPage, currentPage * this.itemsPerPage);
                } else {
                    newWinnings = await this.client.db.getRelativeNetWinnings(leaderboardType, this.itemsPerPage, currentPage * this.itemsPerPage);
                }
                const newLeaderboard = await this.generateLeaderboard(newWinnings, currentPage, leaderboardType);

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
    async generateLeaderboard(winnings, page, leaderboardType) {
        let result = "";
        for (let i = 0; i < winnings.length; i++) {
            result += `${i + 1 + (page * this.itemsPerPage)}. <@${winnings[i].id}>: ${winnings[i].relative_won > 0 ? '+' : ''}${format(winnings[i].relative_won, true)} bets\n`;
        }

        let title;
        if (leaderboardType === 'all') {
            title = `The Ultimate Gambler Leaderboard`
        }else{
            title = `${leaderboardType.charAt(0).toUpperCase() + leaderboardType.slice(1)} Leaderboard`
        }

        return new Discord.EmbedBuilder()
            .setTitle(title)
            .setDescription(result)
            .setFooter({ text: `Page ${page + 1}` });
    }
}

module.exports = GamblerBoard;