const { AdminCommand } = require('./classes/admincommand.js');

class SayDM extends AdminCommand {
    constructor(client) {
        super(client, "say-dm", "Send a direct message to a user", [
            {
                name: 'user',
                type: 6,
                description: 'The user you want to send a message to',
                required: true,
            },
            {
                name: 'message',
                type: 3,
                description: 'The message you want to send',
                required: true,
            }
        ], true);
    }

    async run(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const messageContent = interaction.options.getString('message');

            if (!targetUser || !messageContent) {
                return interaction.editReply('Invalid user or message.')
            }

            await targetUser.send(messageContent);
            await interaction.editReply(`Message sent to ${targetUser.tag}.`)
        } catch (error) {
            console.error('Error sending DM:', error);
            await interaction.editReply('Failed to send the DM.');
        }
    }
}

module.exports = SayDM;
