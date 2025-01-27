require('dotenv').config();
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const SexSession = require('../classes/sexSession.js');

class SexStart extends Command {
    constructor(client) {
        super(client, "start", "Start a sex session with a user", [
            {
                name: 'user',
                description: 'The user to fuck',
                type: 6, // user
                required: true
            }
        ], {isSubcommandOf: "sex"});
    }

    async run(interaction) {
        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;
        const targetId = targetUser.id;
        const allowedUsers = process.env.ALLOWED_USERS.split(',');

        let mod_abooz = targetId == this.client.user.id && allowedUsers.includes(userId)

        // Check if the user is trying to fuck themselves
        if (targetId === userId) {
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`@everyone`)
                    .setDescription(`Please DO NOT announce to the server when you are going to masturbate. This has been a reoccurring issue, and I’m not sure why some people have such under developed social skills that they think that a server full of mostly male strangers would need to know that. No one is going to be impressed and give you a high five (especially considering where that hand has been). I don’t want to add this to the rules, since it would be embarrassing for new users to see that we have a problem with this, but it is going to be enforced as a rule from now on.

If it occurs, you will be warned, then additional occurrences will be dealt with at the discretion of modstaff. Thanks.`)]
            });
            return;
        }

        // Check if the target user is a bot
        if (targetUser.bot && !mod_abooz) {
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`Clank Clank Clank`)]
            });
            return;
        }

        // Check if the user is already fucking someone
        if (this.client.sex_sessions.some(session => session.hasUser(userId))){
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You're already fucking someone!`)
                    .setDescription(`You are already fucking <@${this.client.sex_sessions.find(session => session.hasUser(userId)).otherUser(userId)}>!`)]
            });
            return;
        }

        // Check if the target user is already fucking someone
        if (this.client.sex_sessions.some(session => session.hasUser(targetId))){
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`${targetUser.username} is already fucking someone!`)
                    .setDescription(`<@${targetId}> is already fucking <@${this.client.sex_sessions.find(session => session.hasUser(targetId)).otherUser(targetId)}>!`)]
            });
            return;
        }

        // Send the consent message with buttons
        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('accept_sex')
                    .setLabel('Consent')
                    .setStyle(Discord.ButtonStyle.Success),
                new Discord.ButtonBuilder()
                    .setCustomId('reject_sex')
                    .setLabel('Ew no')
                    .setStyle(Discord.ButtonStyle.Danger)
            );

        await interaction.editReply({
            content: `<@${targetId}>, <@${userId}> wants to fuck you!`,
            embeds: [new Discord.EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`Sex Alarm!!`)
                .setDescription(`<@${userId}> wants to fuck you!`)],
            components: [row]
        });

        // Create a collector to handle button interactions
        const filter = i => (i.customId === 'accept_sex' || i.customId === 'reject_sex');
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute collector

        collector.on('collect', async i => {
            mod_abooz = targetId == this.client.user.id && allowedUsers.includes(i.user.id)
            if (i.user.id !== targetId && !mod_abooz) {
                // Fourth wall break response for unauthorized users
                const responses = [
                    `You wanna... threesome?`,
                    `~~Gamebang~~ Gangbangs are not allowed here!`
                ];

                const randomResponse = responses[Math.floor(Math.random() * responses.length)];

                await i.reply({
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#FFAA00')
                        .setTitle(`Hold On!`)
                        .setDescription(randomResponse)]
                });
                return; // Stop further processing
            }

            if (i.customId === 'accept_sex') {
                await this.client.sex_sessions.push(new SexSession(userId, targetId, 0));

                await i.update({
                    content: `<@${targetUser.id}> agreed to do it!`,
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Here we go`)
                        .setDescription(`<@${userId}> and <@${targetUser.id}> are now fucking!`)]
                });

                collector.stop();
            } else if (i.customId === 'reject_sex') {
                await i.update({
                    content: `<@${targetUser.id}> refused to do it.`,
                    embeds: [new Discord.EmbedBuilder()
                        .setColor('#AA0000')
                        .setTitle(`Ew no`)
                        .setDescription(`<@${targetUser.id}> refused to fuck with <@${userId}>`)]
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

module.exports = SexStart;