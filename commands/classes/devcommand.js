require('dotenv').config();
const { Command } = require('./command.js');

class DevCommand extends Command {
    constructor(client, name, description, options, ephemeral = false){
        super(client, name, description, options, ephemeral);
    }

    async execute(interaction){
        const allowedUsers = process.env.ALLOWED_USERS.split(',');
        if(!allowedUsers.includes(interaction.user.id)){
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