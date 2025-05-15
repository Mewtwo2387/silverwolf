const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const {
  getNextUpgradeCost, getMultiplierAmount, getMultiplierChance, getBekiCooldown, getMaxLevel,
} = require('../utils/upgrades');

class ShopUpgrades extends Command {
  constructor(client) {
    super(client, 'upgrades', 'upgrade your dinonuggie multipliers', [], { isSubcommandOf: 'shop' });
  }

  async run(interaction) {
    const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascensionLevel');
    const maxLevel = getMaxLevel(ascensionLevel);

    const multiplierAmountLevel = await this.client.db.getUserAttr(interaction.user.id, 'multiplierAmountLevel');
    const multiplierRarityLevel = await this.client.db.getUserAttr(interaction.user.id, 'multiplierRarityLevel');
    const bekiLevel = await this.client.db.getUserAttr(interaction.user.id, 'bekiLevel');

    const multiplierAmount = getMultiplierAmount(multiplierAmountLevel);
    const multiplierAmountNext = getMultiplierAmount(Math.min(multiplierAmountLevel + 1, maxLevel));
    const multiplierRarity = getMultiplierChance(multiplierRarityLevel);
    const multiplierRarityNext = getMultiplierChance(Math.min(multiplierRarityLevel + 1, maxLevel));
    const cooldown = getBekiCooldown(bekiLevel);
    const cooldownNext = getBekiCooldown(Math.min(bekiLevel + 1, maxLevel));

    const multiplierAmountCost = getNextUpgradeCost(multiplierAmountLevel);
    const multiplierRarityCost = getNextUpgradeCost(multiplierRarityLevel);
    const bekiCost = getNextUpgradeCost(bekiLevel);

    let desc = '### Multiplier Amount Upgrade\n';
    if (multiplierAmountLevel < maxLevel) {
      desc += `**Level:** ${multiplierAmountLevel}/${maxLevel} -> ${(multiplierAmountLevel + 1)}/${maxLevel}
**Gold Multiplier:** ${format(multiplierAmount.gold, true)}x -> ${format(multiplierAmountNext.gold, true)}x
**Silver Multiplier:** ${format(multiplierAmount.silver, true)}x -> ${format(multiplierAmountNext.silver, true)}x
**Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x -> ${format(multiplierAmountNext.bronze, true)}x
**Cost:** ${format(multiplierAmountCost)} mystic credits
Buy with \`/buy upgrades 1\``;
    } else {
      desc += `**Level:** ${multiplierAmountLevel} (maxed)
**Gold Multiplier:** ${format(multiplierAmount.gold, true)}x
**Silver Multiplier:** ${format(multiplierAmount.silver, true)}x
**Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x`;
    }

    desc += '\n\n### Multiplier Rarity Upgrade\n';
    if (multiplierRarityLevel < maxLevel) {
      desc += `**Level:** ${multiplierRarityLevel}/${maxLevel} -> ${(multiplierRarityLevel + 1)}/${maxLevel}
**Gold Chance:** ${format(multiplierRarity.gold * 100, true)}% -> ${format(multiplierRarityNext.gold * 100, true)}%
**Silver Chance:** ${format(multiplierRarity.silver * 100, true)}% -> ${format(multiplierRarityNext.silver * 100, true)}%
**Bronze Chance:** ${format(multiplierRarity.bronze * 100, true)}% -> ${format(multiplierRarityNext.bronze * 100, true)}%
**Cost:** ${format(multiplierRarityCost)} mystic credits
Buy with \`/buy upgrades 2\``;
    } else {
      desc += `**Level:** ${multiplierRarityLevel} (maxed)
**Gold Chance:** ${format(multiplierRarity.gold * 100, true)}%
**Silver Chance:** ${format(multiplierRarity.silver * 100, true)}%
**Bronze Chance:** ${format(multiplierRarity.bronze * 100, true)}%`;
    }

    desc += '\n\n### Beki Upgrade\n';
    if (bekiLevel < maxLevel) {
      desc += `**Level:** ${bekiLevel}/${maxLevel} -> ${(bekiLevel + 1)}/${maxLevel}
**Cooldown:** ${format(cooldown, true)} hours -> ${format(cooldownNext, true)} hours
**Cost:** ${format(bekiCost)} mystic credits
Buy with \`/buy upgrades 3\``;
    } else {
      desc += `**Level:** ${bekiLevel} (maxed)
**Cooldown:** ${format(cooldown, true)} hours`;
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
