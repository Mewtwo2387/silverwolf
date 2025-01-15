const { Command } = require('./command.js');
const Discord = require('discord.js');
const { log } = require('../../utils/log');

class AdminCommand extends Command {
    constructor(client, name, description, options, args = {ephemeral: false, skipDefer: false, isSubcommand: false}){
        super(client, name, description, options, args);
    }

    async execute(interaction){
        const allowedUsers = process.env.ALLOWED_USERS.split(',');
        if (!interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator) && !allowedUsers.includes(interaction.user.id)) {
            log(`${interaction.user.username} tried using an admin command smh`);
            if(interaction.deferred){
                await interaction.editReply('You do not have permission to use this command.');
            }else{
                await interaction.reply('You do not have permission to use this command.');
            }
            return;
        }
        super.execute(interaction);
    }
}

module.exports = { AdminCommand };