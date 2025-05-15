const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class GameUIDGet extends Command {
  constructor(client) {
    super(client, 'get', 'Get all game UIDs for a user', [
      {
        name: 'user',
        description: 'The user to get the game UIDs for',
        type: 6, // User type
        required: true,
      },
    ], { isSubcommandOf: 'gameuid' });
  }

  async run(interaction) {
    const user = interaction.options.getUser('user');

    try {
      // Get the game UIDs from the database for the specified user
      const gameUIDs = await this.client.db.getGameUIDsForUser(user.id);

      if (!Array.isArray(gameUIDs) || gameUIDs.length === 0) {
        // If no game UIDs are found, reply with a message indicating that
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('#AA0000')
              .setTitle(`No game UIDs found for ${user.tag}`)
              .setDescription('The specified user has not set any game UIDs.'),
          ],
        });
        return;
      }

      // Construct the reply message dynamically based on the retrieved data
      const description = gameUIDs.map((g) => `**Game:** ${g.game}\n**UID:** ${g.gameUid}\n**Region:** ${g.region || 'N/A'}\n`).join('\n');

      // Reply with the user's game UIDs
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`Game UIDs under ${user.tag}:`)
            .setDescription(description),
        ],
      });
    } catch (err) {
      logError('Failed to get game UIDs:', err);

      // Reply with an error message
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle(`Failed to get game UIDs for ${user.tag}`)
            .setDescription('An error occurred while retrieving the game UIDs. Please try again.'),
        ],
      });
    }
  }
}

module.exports = GameUIDGet;
