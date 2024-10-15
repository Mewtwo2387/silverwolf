const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class MarriagePropose extends Command {
    constructor(client) {
        super(client, "marriage-propose", "Propose to a user", [
            {
                name: 'user',
                description: 'The user you want to propose to',
                type: 6, // user
                required: true
            }
        ]);
    }

    async run(interaction) {
        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;

        // Check if the proposing user is already married
        const userMarriageStatus = await this.client.db.checkMarriageStatus(userId);
        if (userMarriageStatus.isMarried) {
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You're already married!`)
                ]
            });
            return;
        }

        // Check if the target user is already married
        const targetMarriageStatus = await this.client.db.checkMarriageStatus(targetUser.id);
        if (targetMarriageStatus.isMarried) {
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`${targetUser.username} is already married!`)
                ]
            });
            return;
        }

        // Send the proposal message with buttons
        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('accept_proposal')
                    .setLabel('Accept')
                    .setStyle(Discord.ButtonStyle.Success),
                new Discord.ButtonBuilder()
                    .setCustomId('reject_proposal')
                    .setLabel('Reject')
                    .setStyle(Discord.ButtonStyle.Danger)
            );

        await interaction.editReply({
            content: `<@${targetUser.id}>, you have a marriage proposal from <@${userId}>!`,
            embeds: [new Discord.EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`Marriage Proposal`)
                .setDescription(`${interaction.user.username} has proposed to you.`)
            ],
            components: [row]
        });

        // Create a collector to handle button interactions
        const filter = i => (i.customId === 'accept_proposal' || i.customId === 'reject_proposal') && i.user.id === targetUser.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute collector

        collector.on('collect', async i => {
            if (i.customId === 'accept_proposal') {
                // Save the marriage to the database
                await this.client.db.addMarriage(userId, targetUser.id);

                await i.update({
                    content: `<@${targetUser.id}> has accepted the proposal! Congratulations!`,
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Proposal Accepted`)
                        .setDescription(`${targetUser.username} and ${interaction.user.username} are now married!`)
                    ],
                    components: []
                });

                collector.stop();
            } else if (i.customId === 'reject_proposal') {
                await i.update({
                    content: `<@${targetUser.id}> has rejected the proposal.`,
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#AA0000')
                        .setTitle(`Proposal Rejected`)
                        .setDescription(`${targetUser.username} has rejected the proposal from ${interaction.user.username}.`)
                    ],
                    components: []
                });

                collector.stop();
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                // If no response was collected, disable the buttons
                await interaction.editReply({
                    content: `The proposal has timed out.`,
                    components: []
                });
            }
        });
    }
}

module.exports = MarriagePropose;
