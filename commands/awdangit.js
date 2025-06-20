const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { log, logError } = require('../utils/log');

class Awdangit extends Command {
  constructor(client) {
    super(client, 'awdangit', '99% chance to earn $1M, 1% chance to become a girl', []);
  }

  async run(interaction) {
    if (Math.random() < 0.01) {
      const roleId = await this.client.db.serverRoles.getServerRole(interaction.guild.id, 'girl');
      const role = interaction.member.guild.roles.cache.find((r) => r.id === roleId);

      log(`${interaction.user.username} became a girl`);

      if (roleId === null) {
        logError(`Girl role is not set up for ${interaction.guild.name}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Error')
              .setDescription('Girl role is not set up for this server!')
              .setColor('#FF0000'),
          ],
        });
        return;
      }

      await interaction.member.roles.add(role);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Congrats!')
            .setDescription('You became a girl!')
            .setColor('#00FF00'),
        ],
      });
    } else {
      log(`${interaction.user.username} earned $1M`);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Aw, dang it!')
            .setDescription('You earned $1M!')
            .setColor('#FF0000'),
        ],
      });
    }
  }
}

module.exports = Awdangit;
