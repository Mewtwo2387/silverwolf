const { Command } = require('./command.js');
const Discord = require('discord.js');

class AdminCommand extends Command {
    constructor(client, name, description, options, ephemeral = false){
        super(client, name, description, options, ephemeral);
    }

    async execute(interaction){
        if (!interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
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