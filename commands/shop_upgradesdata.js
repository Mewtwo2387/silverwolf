const Discord = require('discord.js');
const { Command } = require('./classes/command');
const {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} = require('../utils/upgradesInfo');

class ShopUpgradesData extends Command {
  constructor(client) {
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
      { isSubcommandOf: 'shop' },
    );
  }

  async run(interaction) {
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

module.exports = ShopUpgradesData;
