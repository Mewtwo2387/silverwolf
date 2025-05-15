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
    const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');

    const nuggieFlatMultiplierLevel = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_flat_multiplier_level');
    const nuggieStreakMultiplierLevel = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_streak_multiplier_level');
    const nuggieCreditsMultiplierLevel = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_credits_multiplier_level');
    const nuggiePokemonMultiplierLevel = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_pokemon_multiplier_level');
    const nuggieNuggieMultiplierLevel = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_nuggie_multiplier_level');

    const nuggieFlatMultiplier = getNuggieFlatMultiplier(nuggieFlatMultiplierLevel);
    const nuggieFlatMultiplierNext = getNuggieFlatMultiplier(nuggieFlatMultiplierLevel + 1);
    const nuggieStreakMultiplier = getNuggieStreakMultiplier(nuggieStreakMultiplierLevel);
    const nuggieStreakMultiplierNext = getNuggieStreakMultiplier(nuggieStreakMultiplierLevel + 1);
    const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(nuggieCreditsMultiplierLevel);
    const nuggieCreditsMultiplierNext = getNuggieCreditsMultiplier(nuggieCreditsMultiplierLevel + 1);
    const nuggiePokemonMultiplier = getNuggiePokeMultiplier(nuggiePokemonMultiplierLevel);
    const nuggiePokemonMultiplierNext = getNuggiePokeMultiplier(nuggiePokemonMultiplierLevel + 1);
    const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(nuggieNuggieMultiplierLevel);
    const nuggieNuggieMultiplierNext = getNuggieNuggieMultiplier(nuggieNuggieMultiplierLevel + 1);

    const nuggieFlatMultiplierCost = getNextAscensionUpgradeCost(nuggieFlatMultiplierLevel, 1);
    const nuggieStreakMultiplierCost = getNextAscensionUpgradeCost(nuggieStreakMultiplierLevel, 1);
    const nuggieCreditsMultiplierCost = getNextAscensionUpgradeCost(nuggieCreditsMultiplierLevel, 3);
    const nuggiePokemonMultiplierCost = getNextAscensionUpgradeCost(nuggiePokemonMultiplierLevel, 9);
    const nuggieNuggieMultiplierCost = getNextAscensionUpgradeCost(nuggieNuggieMultiplierLevel, 27);

    const desc = `**Your Ascension level: ${ascensionLevel}**
        
### Nuggie Flat Multiplier Upgrade
Applies a flat multiplier to all claims.
**Level:** ${nuggieFlatMultiplierLevel} -> ${nuggieFlatMultiplierLevel + 1}
**Multiplier:** ${format(nuggieFlatMultiplier)}x -> ${format(nuggieFlatMultiplierNext)}x
**Cost:** ${format(nuggieFlatMultiplierCost)} heavenly nuggies
Buy with \`/buy ascension 1\`

### Nuggie Streak Multiplier Upgrade
Applies a multiplier to all claims based on your current streak.
**Level:** ${nuggieStreakMultiplierLevel} -> ${nuggieStreakMultiplierLevel + 1}
**Multiplier:** +${format(nuggieStreakMultiplier * 100)}%/day -> +${format(nuggieStreakMultiplierNext * 100)}%/day
**Cost:** ${format(nuggieStreakMultiplierCost)} heavenly nuggies
Buy with \`/buy ascension 2\`

### Unlocks at Ascension 2 ${ascensionLevel >= 2 ? '✅' : '❌'}

### Nuggie Credits Multiplier Upgrade
Applies a multiplier to all claims based on your current credits.
**Level:** ${nuggieCreditsMultiplierLevel} -> ${nuggieCreditsMultiplierLevel + 1}
**Multiplier:** +${format(nuggieCreditsMultiplier * 100)}% * log2(credits) -> +${format(nuggieCreditsMultiplierNext * 100)}% * log2(credits)
**Cost:** ${format(nuggieCreditsMultiplierCost)} heavenly nuggies
Buy with \`/buy ascension 3\`

### Unlocks at Ascension 4 ${ascensionLevel >= 4 ? '✅' : '❌'}

### Nuggie PokeMultiplier Upgrade
Applies a multiplier to all claims based on the number of unique pokemons you have.
**Level:** ${nuggiePokemonMultiplierLevel} -> ${nuggiePokemonMultiplierLevel + 1}
**Multiplier:** +${format(nuggiePokemonMultiplier * 100)}%/pokemon -> +${format(nuggiePokemonMultiplierNext * 100)}%/pokemon
**Cost:** ${format(nuggiePokemonMultiplierCost)} heavenly nuggies
Buy with \`/buy ascension 4\`

### Unlocks at Ascension 6 ${ascensionLevel >= 6 ? '✅' : '❌'}

### Nuggie Nuggie Multiplier Upgrade
Applies a multiplier to all claims based on the number of nuggies you have.
**Level:** ${nuggieNuggieMultiplierLevel} -> ${nuggieNuggieMultiplierLevel + 1}
**Multiplier:** +${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies) -> +${format(nuggieNuggieMultiplierNext * 100)}% * log2(nuggies)
**Cost:** ${format(nuggieNuggieMultiplierCost)} heavenly nuggies
Buy with \`/buy ascension 5\`

### Unlocks at Ascension 10 ${ascensionLevel >= 10 ? '✅' : '❌'}

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
