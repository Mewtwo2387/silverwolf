const { Command } = require('./command.js');

class NsfwCommand extends Command {
    constructor(client, name, description, options, ephemeral = false){
        super(client, name, description, options, ephemeral);
    }

    async execute(interaction){
        if(interaction.guild.id != '969953667597893672'){ // basement
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