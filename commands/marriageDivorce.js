const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

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
                ]
            });
            return;
        }

        // Retrieve partner ID
        const partnerId = marriageStatus.partnerId;

        // Confirm divorce
        await interaction.editReply({
            embeds: [new Discord.EmbedBuilder()
                .setColor('#FFAA00')
                .setTitle(`Divorce Confirmation`)
                .setDescription(`Are you sure you want to divorce <@${partnerId}>?`)
            ]
        });

        // Create a button for confirmation
        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('confirm_divorce')
                    .setLabel('Confirm Divorce')
                    .setStyle(Discord.ButtonStyle.Danger)
            );

        // Update the message with the confirmation button
        await interaction.followUp({
            content: `Please confirm your decision:`,
            components: [row]
        });

        // Create a collector to handle the button interaction
        const filter = i => i.customId === 'confirm_divorce' && i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute collector

        collector.on('collect', async i => {
            // Remove marriage from the database
            await this.client.db.removeMarriage(userId, partnerId);

            await i.update({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Divorce Successful`)
                    .setDescription(`You have successfully divorced <@${partnerId}>.`)
                ],
                components: [] // Remove the buttons
            });

            collector.stop();
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                // If no response was collected, disable the buttons
                await interaction.editReply({
                    content: `The divorce request has timed out.`,
                    components: []
                });
            }
        });
    }
}

module.exports = MarriageDivorce;
