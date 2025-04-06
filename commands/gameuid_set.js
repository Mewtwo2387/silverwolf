const Discord = require('discord.js');
const { Command } = require('./classes/command.js');
const { DevCommand } = require('./classes/devcommand.js');
const { logError } = require('../utils/log.js');

class SetGameUID extends Command {
  constructor(client) {
    super(client, 'set', 'Set a game UID for a user', [
      {
        name: 'game',
        description: 'The name of the game',
        type: 3, // String type
        required: true,
        choices: [
          { name: 'Minecraft', value: 'Minecraft' },
          { name: 'Genshin Impact', value: 'Genshin Impact' },
          { name: 'Honkai: Star Rail', value: 'Honkai: Star Rail' },
          { name: 'Honkai Impact 3rd', value: 'Honkai Impact 3rd' },
          { name: 'Zenless Zone Zero', value: 'Zenless Zone Zero' },
          { name: 'Wuthering Waves', value: 'Wuthering Waves' },
          { name: 'Valorant', value: 'Valorant' },
          { name: 'Fate/Grand Order', value: 'Fate/Grand Order' },
          { name: 'Reverse: 1999', value: 'Reverse: 1999' },
          { name: 'Arknights', value: 'Arknights' },
          { name: 'Azur Lane', value: 'Azur Lane' },
          { name: 'Punishing: Gray Raven', value: 'Punishing: Gray Raven' },
          { name: 'Blue Archive', value: 'Blue Archive' },
        ],
      },
      {
        name: 'uid',
        description: 'The game UID to set',
        type: 3, // String type
        required: true,
      },
      {
        name: 'region',
        description: 'The region for the game UID',
        type: 3, // String type
        required: true,
      },
    ], { isSubcommandOf: 'gameuid' });
  }

  async run(interaction) {
    const { user } = interaction;
    const game = interaction.options.getString('game');
    const uid = interaction.options.getString('uid');
    const region = interaction.options.getString('region');

    try {
      // Use the method to add or update the game UID in the database
      await this.client.db.addOrUpdateGameUID(user.id, game, uid, region);

      // Reply with a success message
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`Successfully set game UID for ${user.tag}`)
            .setDescription(`Game: **${game}**\nUID: **${uid}**\nRegion: **${region}**`),
        ],
      });
    } catch (err) {
      logError('Failed to set game UID:', err);

      // Reply with an error message
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle(`Failed to set game UID for ${user.tag}`)
            .setDescription('An error occurred while setting the game UID. Please try again.'),
        ],
      });
    }
  }
}

module.exports = SetGameUID;
