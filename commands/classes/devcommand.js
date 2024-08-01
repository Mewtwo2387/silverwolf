const { Command } = require('./command.js');

class DevCommand extends Command {
    constructor(client, name, description, options){
        super(client, name, description, options);
    }

    async execute(interaction){
        if(interaction.user.id !== '595491647132008469'){
            await interaction.reply('No.');
            return;
        }
        super.execute(interaction);
    }
}

module.exports = { DevCommand };