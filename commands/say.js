const { Command } = require("./classes/command.js");
const Discord = require('discord.js');

class Say extends Command {
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
        // Check if the command is being used in a guild (server)
        if (!interaction.guild) {
            return interaction.editReply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        // Check if the user has the Administrator permission
        if (!interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

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
