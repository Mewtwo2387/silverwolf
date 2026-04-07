import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} from '../utils/upgradesInfo';

class ShopUpgradesData extends Command {
  constructor(client: any) {
    super(
      client,
      'upgradesdata',
      'check stats at a certain level',
      [{
        name: 'level',
        description: 'level',
        type: 4,
        required: true,
      }],
      { isSubcommandOf: 'shop', blame: 'ei' },
    );
  }

  async run(interaction: any): Promise<void> {
    const level = interaction.options.getInteger('level');
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Upgrades')
        .setDescription(getMultiplierAmountInfo(level, INFO_LEVEL.COST_TOTAL)
          + getMultiplierChanceInfo(level, INFO_LEVEL.COST_TOTAL)
          + getBekiCooldownInfo(level, INFO_LEVEL.COST_TOTAL)),
      ],
    });
  }
}

export default ShopUpgradesData;
