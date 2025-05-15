const Discord = require('discord.js');
const { format } = require('../utils/math');
const { Command } = require('./classes/command');
const {
  getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier,
  getNextAscensionUpgradeCost, getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} = require('../utils/ascensionupgrades');

const ASCENSION_UPGRADES = [
  'nuggie_flat_multiplier',
  'nuggie_streak_multiplier',
  'nuggie_credits_multiplier',
  'nuggie_pokemon_multiplier',
  'nuggie_nuggie_multiplier',
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

    const level = await this.client.db.getUserAttr(interaction.user.id, `${upgrade}_level`);

    const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');

    const amplifier = {
      nuggie_flat_multiplier: 1,
      nuggie_streak_multiplier: 1,
      nuggie_credits_multiplier: 3,
      nuggie_pokemon_multiplier: 9,
      nuggie_nuggie_multiplier: 27,
    };

    const levelRequirement = {
      nuggie_flat_multiplier: 1,
      nuggie_streak_multiplier: 1,
      nuggie_credits_multiplier: 2,
      nuggie_pokemon_multiplier: 4,
      nuggie_nuggie_multiplier: 6,
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
    for (let i = 0; i < amount; i++) {
      cost += getNextAscensionUpgradeCost(level + i, amplifier[upgrade]);
    }
    const heavenlyNuggies = await this.client.db.getUserAttr(interaction.user.id, 'heavenly_nuggies');

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

    await this.client.db.addUserAttr(interaction.user.id, 'heavenly_nuggies', -cost);
    await this.client.db.addUserAttr(interaction.user.id, `${upgrade}_level`, amount);

    switch (upgrade) {
      case 'nuggie_flat_multiplier': {
        const nuggieFlatMultiplier = getNuggieFlatMultiplier(level);
        const nextNuggieFlatMultiplier = getNuggieFlatMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Flat Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
Nuggie Flat Multiplier: ${format(nuggieFlatMultiplier)}x -> ${format(nextNuggieFlatMultiplier)}x
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggie_streak_multiplier': {
        const nuggieStreakMultiplier = getNuggieStreakMultiplier(level);
        const nextNuggieStreakMultiplier = getNuggieStreakMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Streak Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggieStreakMultiplier * 100)}%/day -> +${format(nextNuggieStreakMultiplier * 100)}%/day
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggie_credits_multiplier': {
        const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(level);
        const nextNuggieCreditsMultiplier = getNuggieCreditsMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Credits Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits) -> +${format(nextNuggieCreditsMultiplier * 100)}% * log2(credits)
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggie_pokemon_multiplier': {
        const nuggiePokeMultiplier = getNuggiePokeMultiplier(level);
        const nextNuggiePokeMultiplier = getNuggiePokeMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie PokeMultiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggiePokeMultiplier * 100)}%/pokemon -> +${format(nextNuggiePokeMultiplier * 100)}%/pokemon
Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      }
      case 'nuggie_nuggie_multiplier': {
        const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(level);
        const nextNuggieNuggieMultiplier = getNuggieNuggieMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Nuggie Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies) -> +${format(nextNuggieNuggieMultiplier * 100)}% * log2(nuggies)
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
