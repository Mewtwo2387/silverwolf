import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class GameUIDGet extends Command {
  constructor(client: any) {
    super(client, 'get', 'Get all game UIDs for a user', [
      {
        name: 'user',
        description: 'The user to get the game UIDs for',
        type: 6,
        required: true,
      },
    ], { isSubcommandOf: 'gameuid', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const user = interaction.options.getUser('user');

    try {
      const gameUIDs = await this.client.db.gameUID.getAllGameUIDs(user.id);

      if (!Array.isArray(gameUIDs) || gameUIDs.length === 0) {
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

      const description = gameUIDs.map((g: any) => `**Game:** ${g.game}\n**UID:** ${g.gameUid}\n**Region:** ${g.region || 'N/A'}\n`).join('\n');

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

export default GameUIDGet;
