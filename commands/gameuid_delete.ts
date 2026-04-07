import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class GameUIDDelete extends Command {
  constructor(client: any) {
    super(client, 'delete', 'Delete a game UID for the user', [
      {
        name: 'game',
        description: 'The name of the game to delete the UID for',
        type: 3,
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
    ], { isSubcommandOf: 'gameuid', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const { user } = interaction;
    const game = interaction.options.getString('game');

    try {
      const resultMessage = await this.client.db.gameUID.deleteGameUID(user.id, game);

      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor(resultMessage.includes('Successfully') ? '#00AA00' : '#AA0000')
            .setTitle(resultMessage),
        ],
      });
    } catch (err) {
      logError('Failed to delete game UID:', err);

      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle('Failed to delete game UID')
            .setDescription('An error occurred while attempting to delete the game UID. Please try again.'),
        ],
      });
    }
  }
}

export default GameUIDDelete;
