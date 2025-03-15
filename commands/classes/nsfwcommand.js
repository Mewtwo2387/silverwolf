const { Command } = require('./command.js');
const { log } = require('../../utils/log');

class NsfwCommand extends Command {
    constructor(client, name, description, options, args = {ephemeral: false, skipDefer: false, isSubcommandOf: null}){
        super(client, name, description, options, args);
    }

    async execute(interaction){
        if(interaction.guild.id != '969953667597893672'){ // basement
            log(`${interaction.user.username} tried using an nsfw command in ${interaction.guild.name} smh`);
            if(interaction.deferred){
                await interaction.editReply('NSFW commands are not enabled in this server.');
            }else{
                await interaction.reply('NSFW commands are not enabled in this server.');
            }
            return;
        }
        super.execute(interaction);
    }
}

module.exports = { NsfwCommand };