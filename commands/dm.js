const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class SayDM extends Command {
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
        ]);
    }

    async run(interaction) {
        try {
            // Check if the command is being used in a guild (server)
            if (!interaction.guild) {
                return interaction.editReply({ content: 'This command can only be used in a server.', ephemeral: true });
            }

            // Check if the user has the Administrator permission
            if (!interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const messageContent = interaction.options.getString('message');

            if (!targetUser || !messageContent) {
                return interaction.editReply({ content: 'Invalid user or message.', ephemeral: true });
            }

            await targetUser.send(messageContent);
            await interaction.editReply({ content: `Message sent to ${targetUser.tag}.`, ephemeral: true });
        } catch (error) {
            console.error('Error sending DM:', error);
            await interaction.editReply({ content: 'Failed to send the DM.', ephemeral: true });
        }
    }
}

module.exports = SayDM;
