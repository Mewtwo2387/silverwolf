const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { Command } = require('./classes/command.js');
const { logError } = require('../utils/log.js');

class AvatarCommand extends Command {
  constructor(client) {
    super(client, 'avatar', 'Displays the avatar of a user', [
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
          { name: 'Server Avatar', value: 'server' },
        ],
      },
    ]);
  }

  async run(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const avatarType = interaction.options.getString('type') || 'global';

    let avatarUrl;
    let title;

    if (avatarType === 'server' && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        if (member.avatar) {
          avatarUrl = member.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
          title = `Server Avatar of ${user.username}`;
        } else {
          avatarUrl = user.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
          title = `Global avatar of ${user.username} (no server avatar found)`;
        }
      } catch (error) {
        if (error.code === 10007) {
          // Handle the 'Unknown Member' error gracefully
          avatarUrl = user.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
          title = `Global avatar of ${user.username} (user not found in this server)`;
        } else {
          logError('An error occurred while fetching the member:', error);
          return interaction.reply('An error occurred while fetching the avatar.');
        }
      }
    } else {
      avatarUrl = user.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 });
      title = `Global avatar of ${user.username}`;
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
          .setStyle(ButtonStyle.Link),
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

module.exports = AvatarCommand;
