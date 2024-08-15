const { AdminCommand } = require("./classes/admincommand.js");

class Say extends AdminCommand {
    constructor(client) {
        super(client, "say", "say something", [
            {
                name: 'message',
                description: 'the message to say',
                type: 3,
                required: true
            }
        ], true);
    }

    async run(interaction) {
        const input = interaction.options.getString('message').replace(/@/g, '');
        try {
            await interaction.channel.send(input);
            await interaction.editReply({
                content: 'Message sent.',
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            interaction.editReply({
                content: 'Error (Jez, is that you again?).',
                ephemeral: true
            });
        }
    }
}

module.exports = Say;
