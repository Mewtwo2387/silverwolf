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

    const ascension_level = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');

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

    if (ascension_level < levelRequirement[upgrade]) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You cannot buy this upgrade!')
          .setDescription(`You need to be at least ascension ${levelRequirement[upgrade]} to buy this upgrade. You are currently at ascension ${ascension_level}`)
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
    const heavenly_nuggies = await this.client.db.getUserAttr(interaction.user.id, 'heavenly_nuggies');

    if (heavenly_nuggies < cost) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You dont have enough heavenly nuggies')
          .setDescription(`You have ${format(heavenly_nuggies)} heavenly nuggies, but you need ${format(cost)} to buy ${amount > 1 ? `${amount} upgrades` : 'the upgrade'}`)
          .setFooter({ text: 'heavenly nuggies can be obtained by /ascend' }),
        ],
      });
      return;
    }

    await this.client.db.addUserAttr(interaction.user.id, 'heavenly_nuggies', -cost);
    await this.client.db.addUserAttr(interaction.user.id, `${upgrade}_level`, amount);

    switch (upgrade) {
      case 'nuggie_flat_multiplier':
        const nuggie_flat_multiplier = getNuggieFlatMultiplier(level);
        const next_nuggie_flat_multiplier = getNuggieFlatMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Flat Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
Nuggie Flat Multiplier: ${format(nuggie_flat_multiplier)}x -> ${format(next_nuggie_flat_multiplier)}x
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggie_streak_multiplier':
        const nuggie_streak_multiplier = getNuggieStreakMultiplier(level);
        const next_nuggie_streak_multiplier = getNuggieStreakMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Streak Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggie_streak_multiplier * 100)}%/day -> +${format(next_nuggie_streak_multiplier * 100)}%/day
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggie_credits_multiplier':
        const nuggie_credits_multiplier = getNuggieCreditsMultiplier(level);
        const next_nuggie_credits_multiplier = getNuggieCreditsMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Credits Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggie_credits_multiplier * 100)}% * log2(credits) -> +${format(next_nuggie_credits_multiplier * 100)}% * log2(credits)
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggie_pokemon_multiplier':
        const nuggie_pokemon_multiplier = getNuggiePokeMultiplier(level);
        const next_nuggie_pokemon_multiplier = getNuggiePokeMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie PokeMultiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggie_pokemon_multiplier * 100)}%/pokemon -> +${format(next_nuggie_pokemon_multiplier * 100)}%/pokemon
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggie_nuggie_multiplier':
        const nuggie_nuggie_multiplier = getNuggieNuggieMultiplier(level);
        const next_nuggie_nuggie_multiplier = getNuggieNuggieMultiplier(level + amount);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Nuggie Multiplier Upgrade Bought')
            .setDescription(`Level: ${level} -> ${level + amount}
**Multiplier:** +${format(nuggie_nuggie_multiplier * 100)}% * log2(nuggies) -> +${format(next_nuggie_nuggie_multiplier * 100)}% * log2(nuggies)
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
    }
  }
}

module.exports = BuyAscension;
