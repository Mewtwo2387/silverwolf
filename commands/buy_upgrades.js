const Discord = require('discord.js');
const { format } = require('../utils/math');
const { Command } = require('./classes/command');
const {
  getNextUpgradeCost,
  getMaxLevel,
} = require('../utils/upgrades');
const {
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  getMultiplierAmountInfo,
  INFO_LEVEL,
} = require('../utils/upgradesInfo');

const UPGRADES = [
  'multiplierAmount',
  'multiplierRarity',
  'beki',
];

class BuyUpgrades extends Command {
  constructor(client) {
    super(client, 'upgrades', 'buy upgrades', [
      {
        name: 'upgrade',
        description: 'The upgrade to buy',
        type: 4,
        required: true,
      },
      {
        name: 'amount',
        description: 'The amount to buy',
        type: 4,
        required: false,
      },
    ], { isSubcommandOf: 'buy' });
  }

  async run(interaction) {
    const ascensionLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'ascensionLevel');
    const maxLevel = getMaxLevel(ascensionLevel);

    const upgradeId = interaction.options.getInteger('upgrade');

    const amount = interaction.options.getInteger('amount') || 1;

    if (upgradeId < 1 || upgradeId > UPGRADES.length) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid upgrade')
          .setFooter({ text: 'dinonuggie' }),
        ],
      });
      return;
    }

    const upgrade = UPGRADES[upgradeId - 1];

    const level = await this.client.db.user.getUserAttr(interaction.user.id, `${upgrade}Level`);

    if (level >= maxLevel) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Upgrade maxed')
          .setDescription('how far do you even want to go')
          .setFooter({ text: 'increase the cap by ascending' }),
        ],
      });
      return;
    }

    if (level + amount > maxLevel) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You cannot buy this much')
          .setDescription(`The cap is ${maxLevel}, and you are at ${level}. You cannot buy more than ${maxLevel - level} upgrades.`)
          .setFooter({ text: 'increase the cap by ascending' }),
        ],
      });
      return;
    }

    let cost = 0;
    for (let i = 0; i < amount; i += 1) {
      cost += getNextUpgradeCost(level + i);
    }
    const credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');

    if (credits < cost) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You dont have enough mystic credits')
          .setDescription(`You have ${format(credits)} mystic credits, but you need ${format(cost)} to buy the upgrade`)
          .setFooter({ text: 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin' }),
        ],
      });
      return;
    }

    await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -cost);
    await this.client.db.user.addUserAttr(interaction.user.id, `${upgrade}Level`, amount);

    switch (upgrade) {
      case 'multiplierAmount':
        await this.handleBuyMultiplierAmount(interaction, level, cost, credits, amount);
        break;
      case 'multiplierRarity':
        await this.handleBuyMultiplierRarity(interaction, level, cost, credits, amount);
        break;
      case 'beki':
        await this.handleBuyBeki(interaction, level, cost, credits, amount);
        break;
      default:
        throw new Error('Unreachable code');
    }
  }

  async handleBuyMultiplierAmount(interaction, level, cost, credits, amount) {
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Multiplier Amount Upgrade Bought')
        .setDescription(`${getMultiplierAmountInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
        .setFooter({ text: 'dinonuggie' }),
      ],
    });
  }

  async handleBuyMultiplierRarity(interaction, level, cost, credits, amount) {
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Multiplier Rarity Upgrade Bought')
        .setDescription(`${getMultiplierChanceInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
        .setFooter({ text: 'dinonuggie' }),
      ],
    });
  }

  async handleBuyBeki(interaction, level, cost, credits, amount) {
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Beki Upgrade Bought')
        .setDescription(`${getBekiCooldownInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
        .setFooter({ text: 'dinonuggie' }),
      ],
    });
  }
}

module.exports = BuyUpgrades;
