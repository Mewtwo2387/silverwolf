const { Command } = require('./command.js');

class DevCommand extends Command {
    constructor(client, name, description, options, ephemeral = false){
        super(client, name, description, options, ephemeral);
    }

    async execute(interaction){
        if(interaction.user.id !== '595491647132008469'){
            if(interaction.deferred){
                await interaction.editReply('No.');
            }else{
                await interaction.reply('No.');
            }
            return;
        }
        super.execute(interaction);
    }
}

module.exports = { DevCommand };