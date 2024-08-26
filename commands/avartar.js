const { Command } = require('./classes/command.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AvatarCommand extends Command {
    constructor(client) {
        super(client, "avatar", "Displays the avatar of a user", [
            {
                name: 'user',
                type: 6, // USER type
                description: 'The user whose avatar you want to steal',
                required: false,
            },
            {
                name: 'type',
                type: 3, // STRING type
                description: 'global or server avatar',
                required: false,
                choices: [
                    { name: 'Global Avatar', value: 'global' },
                    { name: 'Server Avatar', value: 'server' }
                ]
            }
        ]);
    }

    async run(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const avatarType = interaction.options.getString('type') || 'global';
        
        let avatarUrl;
        let title;

        if (avatarType === 'server' && interaction.guild) {
            const member = await interaction.guild.members.fetch(user.id);
            title = `Server Avatar of ${user.username}`;
            avatarUrl = member.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
        } else {
            title = `Global avatar of ${user.username}`;
            avatarUrl = user.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(title)
            .setImage(avatarUrl.replace('.webp', '.png'));
        
        // Create buttons for downloading in different formats
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Download as PNG')
                    .setURL(avatarUrl.replace('.webp', '.png'))
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Download as JPG')
                    .setURL(avatarUrl.replace('.webp', '.jpg'))
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Download as WEBP')
                    .setURL(avatarUrl)
                    .setStyle(ButtonStyle.Link)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }
}

module.exports = AvatarCommand;
