const Discord = require('discord.js');
const { format } = require('../utils/math');
const { Command } = require('./classes/command');
const {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
} = require('../utils/ascensionupgradesInfo');
const { INFO_LEVEL } = require('../utils/upgradesInfo');
const { getNextAscensionUpgradeCost } = require('../utils/ascensionupgrades');

const ASCENSION_UPGRADES = [
  'nuggieFlatMultiplier',
  'nuggieStreakMultiplier',
  'nuggieCreditsMultiplier',
  'nuggiePokeMultiplier',
  'nuggieNuggieMultiplier',
];

class BuyAscension extends Command {
  constructor(client) {
    super(client, 'ascension', 'buy ascension upgrades', [
      {
        name: 'upgrade',
        description: 'The upgrade to buy',
        type: 4,
        required: true,
      },
      {
        name: 'amount',
        description: 'The number of levels to buy at once',
        type: 4,
        required: false,
      },
    ], { isSubcommandOf: 'buy' });
  }

  async run(interaction) {
    const upgradeId = interaction.options.getInteger('upgrade');

    if (upgradeId < 1 || upgradeId > ASCENSION_UPGRADES.length) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid upgrade')
          .setFooter({ text: 'dinonuggie' }),
        ],
      });
      return;
    }

    const upgrade = ASCENSION_UPGRADES[upgradeId - 1];

    const level = await this.client.db.user.getUserAttr(interaction.user.id, `${upgrade}Level`);

    const ascensionLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'ascensionLevel');

    const amplifier = {
      nuggieFlatMultiplier: 1,
      nuggieStreakMultiplier: 1,
      nuggieCreditsMultiplier: 3,
      nuggiePokeMultiplier: 9,
      nuggieNuggieMultiplier: 27,
    };

    const levelRequirement = {
      nuggieFlatMultiplier: 1,
      nuggieStreakMultiplier: 1,
      nuggieCreditsMultiplier: 2,
      nuggiePokeMultiplier: 4,
      nuggieNuggieMultiplier: 6,
    };

    if (ascensionLevel < levelRequirement[upgrade]) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You cannot buy this upgrade!')
          .setDescription(`You need to be at least ascension ${levelRequirement[upgrade]} to buy this upgrade. You are currently at ascension ${ascensionLevel}`)
          .setFooter({ text: 'dinonuggie' }),
        ],
      });
      return;
    }

    const amount = interaction.options.getInteger('amount') || 1;

    let cost = 0;
    for (let i = 0; i < amount; i += 1) {
      cost += getNextAscensionUpgradeCost(level + i, amplifier[upgrade]);
    }
    const heavenlyNuggies = await this.client.db.user.getUserAttr(interaction.user.id, 'heavenlyNuggies');

    if (heavenlyNuggies < cost) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You dont have enough heavenly nuggies')
          .setDescription(`You have ${format(heavenlyNuggies)} heavenly nuggies, but you need ${format(cost)} to buy ${amount > 1 ? `${amount} upgrades` : 'the upgrade'}`)
          .setFooter({ text: 'heavenly nuggies can be obtained by /ascend' }),
        ],
      });
      return;
    }

    await this.client.db.user.addUserAttr(interaction.user.id, 'heavenlyNuggies', -cost);
    await this.client.db.user.addUserAttr(interaction.user.id, `${upgrade}Level`, amount);

    switch (upgrade) {
      case 'nuggieFlatMultiplier': {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Flat Multiplier Upgrade Bought')
            .setDescription(`${getNuggieFlatMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggieStreakMultiplier': {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Streak Multiplier Upgrade Bought')
            .setDescription(`${getNuggieStreakMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggieCreditsMultiplier': {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Credits Multiplier Upgrade Bought')
            .setDescription(`${getNuggieCreditsMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggiePokeMultiplier': {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie PokeMultiplier Upgrade Bought')
            .setDescription(`${getNuggiePokeMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggieNuggieMultiplier': {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Nuggie Multiplier Upgrade Bought')
            .setDescription(`${getNuggieNuggieMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      default:
        break;
    }
  }
}

module.exports = BuyAscension;
