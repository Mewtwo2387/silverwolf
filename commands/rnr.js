const { Command } = require('./classes/command.js');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class RnRCommand extends Command {
    constructor(client) {
        super(client, "rnr", "Risk & Reward: how much are you willing to?", [{
            name: 'amount',
            description: 'The amount of credits to bet.',
            type: 4,
            required: true
        }]);
    }

    async run(interaction) {
        const amount = interaction.options.getInteger('amount');
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        
        if (amount <= 0) {
            return interaction.editReply('Please enter a valid amount greater than 0.');
        }

        if (amount > credits) {
            return interaction.editReply({embeds: [ new EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`You don't have enough credits to bet that much!`)
            ]});
        }

        let currentAmount = amount;
        let failureChance = 20;
        let rewardMultiplier = 1.2; // 120%
        let round = 1;

        const embed = new EmbedBuilder()
            .setTitle("RnR Minigame")
            .setDescription(`You have an opportunity to win ${rewardMultiplier * 100}% of your current bet.\n\nWould you like to continue?`)
            .setFooter({ text: `Current Bet: ${currentAmount}` })
            .setColor("#FFD700");

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('continue')
                    .setLabel('Continue')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('step_out')
                    .setLabel('No balls')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'continue') {
                const rng = Math.random() * 100;
                if (rng < failureChance) {
                    await this.client.db.addUserAttr(interaction.user.id, 'credits', -currentAmount); 
                    await i.update({ embeds: [embed.setDescription(`Aw, you lost! You lost ${currentAmount} credits.`).setColor("#FF0000")], components: [] });
                    collector.stop();
                } else if (failureChance === 100) {
                    const finalAmount = amount * 2; // Reward multiplier at 100% failure chance
                    await this.client.db.addUserAttr(interaction.user.id, 'credits', finalAmount - amount); // Add final amount minus initial bet
                    await i.update({ embeds: [embed.setDescription(`Congratulations! You won +100% of your initial bet!`).setColor("#00FF00")], components: [] });
                    collector.stop();
                } else {
                    currentAmount *= rewardMultiplier;
                    round++;
                    failureChance += 20;

                    // Update multiplier in a progressive manner
                    rewardMultiplier = Math.min(2.0, rewardMultiplier + 0.2);

                    embed.setDescription(`Congratulations! You won ${currentAmount} credits.\n\nWould you like to continue? The failure rate is now ${failureChance}%.`)
                        .setFooter({ text: `Current Bet: ${currentAmount}` });

                    await i.update({ embeds: [embed] });
                }
            } else if (i.customId === 'step_out') {
                const finalAmount = currentAmount - amount;
                await this.client.db.addUserAttr(interaction.user.id, 'credits', finalAmount); // Add final amount minus initial bet
                embed.setDescription(`You have won ${finalAmount} credits. However, you missed an opportunity to win more.`)
                    .setColor("#0000FF");
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async () => {
            if (!interaction.replied || !interaction.deferred) {
                await this.client.db.addUserAttr(interaction.user.id, 'credits', -amount); // Deduct initial bet on timeout
                await interaction.editReply({ embeds: [new EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You took too long and lost ${amount} credits!`)
                ], components: [] });
            }
        });
    }
}

module.exports = RnRCommand;
