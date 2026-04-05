import * as Discord from 'discord.js';
import { DevCommand } from './classes/DevCommand';
import { format, antiFormat } from '../utils/math';
import { logError } from '../utils/log';

class DevSet extends DevCommand {
  constructor(client: any) {
    super(client, 'set', 'set data of a user', [
      {
        name: 'user',
        description: 'the user to set something of',
        type: 6,
        required: true,
      },
      {
        name: 'attr',
        description: 'the thing to set',
        type: 3,
        required: true,
      },
      {
        name: 'value',
        description: 'the value to set',
        type: 3,
        required: true,
      },
    ], { isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const user = interaction.options.getUser('user');
    const attr = interaction.options.getString('attr');
    const amountString = interaction.options.getString('value');

    const amount = antiFormat(amountString);
    if (Number.isNaN(amount)) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid amount')
          .setDescription('idk if this parsing actually works'),
        ],
      });
      return;
    }
    try {
      await this.client.db.user.setUserAttr(user.id, attr, amount);
    } catch (error) {
      logError('Failed to set user attribute:', error);
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle(`Failed to set ${format(amount)} ${attr} to ${user.tag}`),
        ],
      });
      return;
    }
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`Set ${format(amount)} ${attr} to ${user.tag}`),
      ],
    });
  }
}

export default DevSet;
