const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const {
  getMultiplierAmount, getMultiplierChance, getBekiCooldown, getNextUpgradeCost, getTotalUpgradeCost,
} = require('../utils/upgrades');

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
    const multiplierAmount = getMultiplierAmount(level);
    const multiplierAmountNext = getMultiplierAmount(level + 1);
    const multiplierRarity = getMultiplierChance(level);
    const multiplierRarityNext = getMultiplierChance(level + 1);
    const bekiCooldown = getBekiCooldown(level);
    const bekiCooldownNext = getBekiCooldown(level + 1);
    const cost = getNextUpgradeCost(level);
    const costTotal = getTotalUpgradeCost(level);
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Upgrades')
        .setDescription(`### Multiplier Amount Upgrade
**Level:** ${level} -> ${(level + 1)}
**Gold Multiplier:** ${format(multiplierAmount.gold, true)}x -> ${format(multiplierAmountNext.gold, true)}x
**Silver Multiplier:** ${format(multiplierAmount.silver, true)}x -> ${format(multiplierAmountNext.silver, true)}x
**Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x -> ${format(multiplierAmountNext.bronze, true)}x
**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits

### Multiplier Rarity Upgrade
**Level:** ${level} -> ${level + 1}
**Gold Chance:** ${format(multiplierRarity.gold * 100, true)}% -> ${format(multiplierRarityNext.gold * 100 + 0.5, true)}%
**Silver Chance:** ${format(multiplierRarity.silver * 100, true)}% -> ${format(multiplierRarityNext.silver * 100 + 1, true)}%
**Bronze Chance:** ${format(multiplierRarity.bronze * 100, true)}% -> ${format(multiplierRarityNext.bronze * 100 + 2, true)}%
**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits

### Beki Upgrade
**Level:** ${level} -> ${level + 1}
**Cooldown:** ${format(bekiCooldown, true)} hours -> ${format(bekiCooldownNext, true)} hours
**Cost for ${level} to ${level + 1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(costTotal)} mystic credits`),
      ],
    });
  }
}

module.exports = ShopUpgradesData;
