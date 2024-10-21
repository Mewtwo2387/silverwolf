const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const divorceSettlement = require('../utils/divorceSettlement.js');
const { format } = require('../utils/math.js');

class MarriageDivorce extends Command {
    constructor(client) {
        super(client, "marriage-divorce", "Divorce your spouse", []);
    }

    async run(interaction) {
        const userId = interaction.user.id;

        // Check marriage status
        const marriageStatus = await this.client.db.checkMarriageStatus(userId);

        if (!marriageStatus.isMarried) {
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`Divorce Status`)
                    .setDescription(`You are not married, so you cannot initiate a divorce.`)
                    .setImage(`https://media1.tenor.com/m/8h3p86xYBSsAAAAC/how-to-lose-a-guy-in10days-andy.gif`)]
            });
            return;
        }

        // Retrieve partner ID
        const partnerId = marriageStatus.partnerId;

        // Send a confirmation message with buttons for confirming or canceling the divorce
        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('confirm_divorce')
                    .setLabel('Confirm Divorce')
                    .setStyle(Discord.ButtonStyle.Danger),
                new Discord.ButtonBuilder()
                    .setCustomId('cancel_divorce')
                    .setLabel('Cancel Divorce')
                    .setStyle(Discord.ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [new Discord.EmbedBuilder()
                .setColor('#FFAA00')
                .setTitle(`Divorce Confirmation`)
                .setDescription(`Are you sure you want to divorce <@${partnerId}>? You will receive 20% of <@${partnerId}>'s total assets and they will receive 80% of your total assets.`)],
            components: [row]
        });

        // Create a collector to handle button interactions
        const filter = i => i.customId === 'confirm_divorce' || i.customId === 'cancel_divorce';
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                const responses = [
                    `Yo <@${i.user.id}>, this is not for you to decide!`,
                    `Hey <@${i.user.id}>! You can't interfere in this divorce!`,
                    `Hello <@${i.user.id}>? What are you trying to do? This is between them, not you.`,
                    `Excuse me, <@${i.user.id}>? This is a private matter!`
                ];

                const gifs = [
                    'https://media1.tenor.com/m/5IBH0NSUPLQAAAAC/lynette-genshin-impact.gif',
                    'https://media1.tenor.com/m/Db72dfVmRUoAAAAC/anime-game.gif',
                    'https://media1.tenor.com/m/VFSdoooIp14AAAAC/genshin-impact.gif',
                    'https://media1.tenor.com/m/N5jGrowCtRIAAAAC/venti-paimon-slap.gif',
                    'https://media1.tenor.com/m/DXMFACgb6EsAAAAd/hotaru-firefly.gif'
                ];

                // Randomly select a response and GIF
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

                await i.reply({
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#FFAA00')
                        .setTitle(`Hold On!`)
                        .setDescription(randomResponse)
                        .setImage(randomGif)],
                    ephemeral: true // Only the user who clicked the button will see this
                });
                return; // Stop further processing
            }

            if (i.customId === 'confirm_divorce') {
                // Call divorceSettlement function
                const settlement = await divorceSettlement(this.client, userId, partnerId);

                // Remove marriage from the database
                await this.client.db.removeMarriage(userId, partnerId);

                await i.update({
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Divorce Successful`)
                        .setDescription(`You have successfully divorced <@${partnerId}>.\nSettlement:\n` +
                            `**You received:** ${format(settlement.initiator.dinonuggies)} dinonuggies and ${format(settlement.initiator.credits)} credits. (20% of <@${partnerId}>'s total assets)\n` +
                            `**<@${partnerId}> received:** ${format(settlement.target.dinonuggies)} dinonuggies and ${format(settlement.target.credits)} credits. (80% of your total assets)`)],
                    components: []
                });

            } else if (i.customId === 'cancel_divorce') {
                await i.update({
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Divorce Canceled`)
                        .setDescription(`The divorce request has been canceled.`)],
                    components: []
                });
            }

            collector.stop();
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await interaction.editReply({
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#AA0000')
                        .setTitle(`Divorce Request Timed Out`)
                        .setDescription(`The divorce request has timed out.`)],
                    components: []
                });
            }
        });
    }
}

module.exports = MarriageDivorce;