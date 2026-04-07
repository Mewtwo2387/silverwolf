import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} from '../utils/upgradesInfo';
import { getMaxLevel } from '../utils/upgrades';
import { format } from '../utils/math';

class ShopUpgrades extends Command {
  constructor(client: any) {
    super(client, 'upgrades', 'upgrade your dinonuggie multipliers', [], { isSubcommandOf: 'shop', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const ascensionLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'ascensionLevel');
    const maxLevel = getMaxLevel(ascensionLevel);

    const multiplierAmountLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'multiplierAmountLevel');
    const multiplierRarityLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'multiplierRarityLevel');
    const bekiLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'bekiLevel');

    const dinonuggies = await this.client.db.user.getUserAttr(interaction.user.id, 'dinonuggies');

    let desc = `**Your Dinonuggies: ${format(dinonuggies)}**\n`;
    if (multiplierAmountLevel < maxLevel) {
      desc += getMultiplierAmountInfo(multiplierAmountLevel, INFO_LEVEL.SHOP_INFO);
    } else {
      desc += getMultiplierAmountInfo(multiplierAmountLevel, INFO_LEVEL.THIS_LEVEL);
    }

    if (multiplierRarityLevel < maxLevel) {
      desc += getMultiplierChanceInfo(multiplierRarityLevel, INFO_LEVEL.SHOP_INFO);
    } else {
      desc += getMultiplierChanceInfo(multiplierRarityLevel, INFO_LEVEL.THIS_LEVEL);
    }

    if (bekiLevel < maxLevel) {
      desc += getBekiCooldownInfo(bekiLevel, INFO_LEVEL.SHOP_INFO);
    } else {
      desc += getBekiCooldownInfo(bekiLevel, INFO_LEVEL.THIS_LEVEL);
    }

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Upgrades')
        .setDescription(desc),
      ],
    });
  }
}

export default ShopUpgrades;
