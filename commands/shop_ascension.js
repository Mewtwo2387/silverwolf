const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const {
  getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier,
  getNextAscensionUpgradeCost, getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} = require('../utils/ascensionupgrades');

class AscensionUpgrade extends Command {
  constructor(client) {
    super(client, 'ascension', 'buy strong upgrades with your heavenly nuggies', [], { isSubcommandOf: 'shop' });
  }

  async run(interaction) {
    const ascension_level = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');

    const nuggie_flat_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_flat_multiplier_level');
    const nuggie_streak_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_streak_multiplier_level');
    const nuggie_credits_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_credits_multiplier_level');
    const nuggie_pokemon_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_pokemon_multiplier_level');
    const nuggie_nuggie_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_nuggie_multiplier_level');

    const nuggie_flat_multiplier = getNuggieFlatMultiplier(nuggie_flat_multiplier_level);
    const nuggie_flat_multiplier_next = getNuggieFlatMultiplier(nuggie_flat_multiplier_level + 1);
    const nuggie_streak_multiplier = getNuggieStreakMultiplier(nuggie_streak_multiplier_level);
    const nuggie_streak_multiplier_next = getNuggieStreakMultiplier(nuggie_streak_multiplier_level + 1);
    const nuggie_credits_multiplier = getNuggieCreditsMultiplier(nuggie_credits_multiplier_level);
    const nuggie_credits_multiplier_next = getNuggieCreditsMultiplier(nuggie_credits_multiplier_level + 1);
    const nuggie_pokemon_multiplier = getNuggiePokeMultiplier(nuggie_pokemon_multiplier_level);
    const nuggie_pokemon_multiplier_next = getNuggiePokeMultiplier(nuggie_pokemon_multiplier_level + 1);
    const nuggie_nuggie_multiplier = getNuggieNuggieMultiplier(nuggie_nuggie_multiplier_level);
    const nuggie_nuggie_multiplier_next = getNuggieNuggieMultiplier(nuggie_nuggie_multiplier_level + 1);

    const nuggie_flat_multiplier_cost = getNextAscensionUpgradeCost(nuggie_flat_multiplier_level, 1);
    const nuggie_streak_multiplier_cost = getNextAscensionUpgradeCost(nuggie_streak_multiplier_level, 1);
    const nuggie_credits_multiplier_cost = getNextAscensionUpgradeCost(nuggie_credits_multiplier_level, 3);
    const nuggie_pokemon_multiplier_cost = getNextAscensionUpgradeCost(nuggie_pokemon_multiplier_level, 9);
    const nuggie_nuggie_multiplier_cost = getNextAscensionUpgradeCost(nuggie_nuggie_multiplier_level, 27);

    const desc = `**Your Ascension level: ${ascension_level}**
        
### Nuggie Flat Multiplier Upgrade
Applies a flat multiplier to all claims.
**Level:** ${nuggie_flat_multiplier_level} -> ${nuggie_flat_multiplier_level + 1}
**Multiplier:** ${format(nuggie_flat_multiplier)}x -> ${format(nuggie_flat_multiplier_next)}x
**Cost:** ${format(nuggie_flat_multiplier_cost)} heavenly nuggies
Buy with \`/buy ascension 1\`

### Nuggie Streak Multiplier Upgrade
Applies a multiplier to all claims based on your current streak.
**Level:** ${nuggie_streak_multiplier_level} -> ${nuggie_streak_multiplier_level + 1}
**Multiplier:** +${format(nuggie_streak_multiplier * 100)}%/day -> +${format(nuggie_streak_multiplier_next * 100)}%/day
**Cost:** ${format(nuggie_streak_multiplier_cost)} heavenly nuggies
Buy with \`/buy ascension 2\`

### Unlocks at Ascension 2 ${ascension_level >= 2 ? '✅' : '❌'}

### Nuggie Credits Multiplier Upgrade
Applies a multiplier to all claims based on your current credits.
**Level:** ${nuggie_credits_multiplier_level} -> ${nuggie_credits_multiplier_level + 1}
**Multiplier:** +${format(nuggie_credits_multiplier * 100)}% * log2(credits) -> +${format(nuggie_credits_multiplier_next * 100)}% * log2(credits)
**Cost:** ${format(nuggie_credits_multiplier_cost)} heavenly nuggies
Buy with \`/buy ascension 3\`

### Unlocks at Ascension 4 ${ascension_level >= 4 ? '✅' : '❌'}

### Nuggie PokeMultiplier Upgrade
Applies a multiplier to all claims based on the number of unique pokemons you have.
**Level:** ${nuggie_pokemon_multiplier_level} -> ${nuggie_pokemon_multiplier_level + 1}
**Multiplier:** +${format(nuggie_pokemon_multiplier * 100)}%/pokemon -> +${format(nuggie_pokemon_multiplier_next * 100)}%/pokemon
**Cost:** ${format(nuggie_pokemon_multiplier_cost)} heavenly nuggies
Buy with \`/buy ascension 4\`

### Unlocks at Ascension 6 ${ascension_level >= 6 ? '✅' : '❌'}

### Nuggie Nuggie Multiplier Upgrade
Applies a multiplier to all claims based on the number of nuggies you have.
**Level:** ${nuggie_nuggie_multiplier_level} -> ${nuggie_nuggie_multiplier_level + 1}
**Multiplier:** +${format(nuggie_nuggie_multiplier * 100)}% * log2(nuggies) -> +${format(nuggie_nuggie_multiplier_next * 100)}% * log2(nuggies)
**Cost:** ${format(nuggie_nuggie_multiplier_cost)} heavenly nuggies
Buy with \`/buy ascension 5\`

### Unlocks at Ascension 10 ${ascension_level >= 10 ? '✅' : '❌'}

### Aeons
TBA

`;

    const embed = new Discord.EmbedBuilder()
      .setTitle('Ascension Upgrades')
      .setDescription(desc)
      .setColor(0x0099ff);

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = AscensionUpgrade;
