const { Command } = require('./command.js');

class DevCommand extends Command {
    constructor(client, name, description, options, ephemeral = false, ignoreDefer = false){
        super(client, name, description, options, ephemeral, ignoreDefer);
    }

    async execute(interaction){
        if(interaction.user.id !== '595491647132008469'){
            await interaction.editReply('No.');
            return;
        }
        super.execute(interaction);
    }
}

module.exports = { DevCommand };