const Discord = require('discord.js');
const { Command } = require('./classes/command');
const {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} = require('../utils/upgradesInfo');
const { getMaxLevel } = require('../utils/upgrades');
const { format } = require('../utils/math');

class ShopUpgrades extends Command {
  constructor(client) {
    super(client, 'upgrades', 'upgrade your dinonuggie multipliers', [], { isSubcommandOf: 'shop' });
  }

  async run(interaction) {
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

module.exports = ShopUpgrades;
