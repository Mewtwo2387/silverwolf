const { Command } = require("./classes/command.js");

class Say extends Command {
    constructor(client){
        super(client, "say", "say something", [
            {
                name: 'message',
                description: 'the message to say',
                type: 3,
                required: true
            }
        ], true);
    }

    async run(interaction){
        const input = interaction.options.getString('message').replace(/@/g, '');
        try{
            await interaction.channel.send(input);
            await interaction.editReply({
                content: 'message sent',
                ephemeral: true
            });
        }catch(error){
            console.error(error);
            interaction.editReply({
                content: 'error (jez is that you again)',
                ephemeral: true
            });
        }
    }
}

module.exports = Say;