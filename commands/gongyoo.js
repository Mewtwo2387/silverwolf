const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

const cooldowns = new Map(); // Map to track cooldowns
const COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class WinOrBust extends Command {
    constructor(client) {
        super(client, "recruiter-game-오징어게임", "is this a squid game reference?", []);
    }

    async run(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();

        // Check cooldown
        if (cooldowns.has(userId)) {
            const cooldownEnd = cooldowns.get(userId);
            if (now < cooldownEnd) {
                const remainingTime = cooldownEnd - now;
                const hours = Math.floor(remainingTime / (60 * 60 * 1000));
                const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
                const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

                const cooldownEmbed = new Discord.EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Cooldown Active')
                    .setDescription(
                        `You can use this command again in **${hours}h ${minutes}m ${seconds}s**.\n\nSee you again tomorrow for more!`
                    )
                    .setImage('https://media1.tenor.com/m/MUGXIqovlEoAAAAd/salesman-gong-yoo.gif');

                await interaction.editReply({ embeds: [cooldownEmbed] });
                return;
            }
        }

        // Set cooldown for user
        cooldowns.set(userId, now + COOLDOWN_TIME);

        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

        const fee = Math.floor(credits * 0.05);
        const winCredits = Math.floor(credits * 0.10);
        const loseCredits = Math.floor(credits * 0.10);

        const embed = new Discord.EmbedBuilder()
            .setColor('#00AAFF')
            .setTitle('Win or Bust!')
            .setDescription(`Test your luck! You have 60 seconds to decide:

**Left Button**: Gain **10%** of your current credits (**+${format(winCredits)} credits**).
**Right Button**: Risk **10%** of your credits (**-${format(loseCredits)} credits**) for:
- A chance to win **50x your current dinonuggie count!**`)
            .setFooter({ text: 'Make your choice wisely!' })
            .setImage('https://media1.tenor.com/m/jYKFyMNCsPgAAAAC/choose-one-squid-game-season-2.gif');

        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('win_or_bust_left')
                    .setLabel('Take +10% Credits')
                    .setStyle(Discord.ButtonStyle.Success),
                new Discord.ButtonBuilder()
                    .setCustomId('win_or_bust_right')
                    .setLabel(`Nah I'd Gamble`)
                    .setStyle(Discord.ButtonStyle.Danger)
            );

        const message = await interaction.editReply({
            embeds: [embed],
            components: [row],
        });

        const collector = message.createMessageComponentCollector({
            time: 60000, // 60 seconds
        });

        let choiceMade = false;

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({ content: "This isn't your game!", ephemeral: true });
                return;
            }

            choiceMade = true;
            collector.stop();

            if (buttonInteraction.customId === 'win_or_bust_left') {
                // Add 10% credits
                await this.client.db.addUserAttr(interaction.user.id, 'credits', winCredits);

                const winEmbed = new Discord.EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('You chose wisely!')
                    .setDescription(`You gained **+${format(winCredits)} credits**!`)
                    .setImage('https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif');

                await interaction.editReply({ embeds: [winEmbed], components: [] });
            } else if (buttonInteraction.customId === 'win_or_bust_right') {
                const rng = Math.random();
                const winMultiplier = 50;

                if (rng <= 0.003) {
                    // 0.3% chance: Win 50x dinonuggies
                    const winnings = dinonuggies * winMultiplier;
                    await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', winnings);

                    const jackpotEmbed = new Discord.EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('Jackpot!')
                        .setDescription(`🎉 YOU WON **50x YOUR DINONUGGIE COUNT**! 🎉
You gained **+${format(winnings)} dinonuggies**!`)
                        .setImage('https://media1.tenor.com/m/dGx7QjIRZ7wAAAAd/celebrating-seong-gi-hun.gif');

                    await interaction.editReply({ embeds: [jackpotEmbed], components: [] });
                } else if (rng <= 0.503) {
                    // 50% chance: Lose streak
                    await this.client.db.addUserAttr(interaction.user.id, 'credits', -loseCredits);
                    await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 0);

                    const loseStreakEmbed = new Discord.EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Bust!')
                        .setDescription(`You lost **-${format(loseCredits)} credits** and your **dinonuggie claim streak**.`)
                        .setImage('https://media1.tenor.com/m/3Xvc3_wnE_oAAAAd/squid-game-screwed.gif');

                    await interaction.editReply({ embeds: [loseStreakEmbed], components: [] });
                } else {
                    // Normal loss: Lose 10% credits
                    await this.client.db.addUserAttr(interaction.user.id, 'credits', -loseCredits);

                    const lossEmbed = new Discord.EmbedBuilder()
                        .setColor('#FF4500')
                        .setTitle('You lost!')
                        .setDescription(`You lost **-${format(loseCredits)} credits**! Better luck next time.`)
                        .setImage('https://media1.tenor.com/m/xXLgviXVqI8AAAAd/squid-game-salesman.gif');

                    await interaction.editReply({ embeds: [lossEmbed], components: [] });
                }
            }
        });

        collector.on('end', async () => {
            if (!choiceMade) {
                await this.client.db.addUserAttr(interaction.user.id, 'credits', -fee);

                const timeoutEmbed = new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle('Timeout!')
                    .setDescription(`You took too long to decide and lost **-${format(fee)} credits** as an entrance fee.`)
                    .setImage('https://media1.tenor.com/m/kvJMZJAiYrMAAAAd/squid-game-slap.gif');

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
            }
        });
    }
}

module.exports = WinOrBust;
