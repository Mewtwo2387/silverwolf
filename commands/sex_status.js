const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const SexSession = require('../classes/sexSession.js');

class SexStatus extends Command {
    constructor(client) {
        super(client, "status", "Check the status of you or another user's sex session", [
            {
                name: 'user',
                description: 'The user to check the status of',
                type: 6, // user
                required: false
            }
        ], {isSubcommandOf: "sex"});
    }

    async run(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;
        const session = this.client.sex_sessions.find(session => session.hasUser(userId));
        if (session) {
            const embed = new Discord.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`${user.username}'s sex session`)
                .setDescription(`<@${session.otherUser(userId)}> is currently fucking <@${userId}>!
They've done ${session.thrusts} thrusts`)
            await interaction.editReply({embeds: [embed]});
        } else {
            const embed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`${user.username} is currently not fucking anyone!`)
            await interaction.editReply({embeds: [embed]});
        }
    }
}

module.exports = SexStatus;