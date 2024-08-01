const { Command } = require('./classes/command.js');

class Say extends Command {
    constructor(client){
        super(client, "say", "say something", [
            {
                name: 'message',
                description: 'the message to say',
                type: 3,
                required: true
            }
        ]);
    }

    async run(interaction){
        const input = interaction.options.getString('message').replace(/@/g, '');
        try{
            await interaction.deferReply({
                ephemeral: true
            });
            await interaction.channel.send(input);
            await interaction.editReply({
                content: 'message sent',
                ephemeral: true
            });
        }catch(error){
            console.error(error);
            interaction.reply({
                content: 'error (jez is that you again)',
                ephemeral: true
            });
        }
    }
}

module.exports = Say;