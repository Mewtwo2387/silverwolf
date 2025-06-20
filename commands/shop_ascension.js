const Discord = require('discord.js');
const { Command } = require('./classes/command');
const {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
} = require('../utils/ascensionupgradesInfo');
const { INFO_LEVEL } = require('../utils/upgradesInfo');

class AscensionUpgrade extends Command {
  constructor(client) {
    super(client, 'ascension', 'buy strong upgrades with your heavenly nuggies', [], { isSubcommandOf: 'shop' });
  }

  async run(interaction) {
    const ascensionLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'ascensionLevel');

    const nuggieFlatMultiplierLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'nuggieFlatMultiplierLevel');
    const nuggieStreakMultiplierLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'nuggieStreakMultiplierLevel');
    const nuggieCreditsMultiplierLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'nuggieCreditsMultiplierLevel');
    const nuggiePokemonMultiplierLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'nuggiePokemonMultiplierLevel');
    const nuggieNuggieMultiplierLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'nuggieNuggieMultiplierLevel');

    const desc = `**Your Ascension level: ${ascensionLevel}**
        
${getNuggieFlatMultiplierInfo(nuggieFlatMultiplierLevel, INFO_LEVEL.SHOP_INFO)}

${getNuggieStreakMultiplierInfo(nuggieStreakMultiplierLevel, INFO_LEVEL.SHOP_INFO)}

### Unlocks at Ascension 2 ${ascensionLevel >= 2 ? '✅' : '❌'}

${getNuggieCreditsMultiplierInfo(nuggieCreditsMultiplierLevel, INFO_LEVEL.SHOP_INFO)}

### Unlocks at Ascension 4 ${ascensionLevel >= 4 ? '✅' : '❌'}

${getNuggiePokeMultiplierInfo(nuggiePokemonMultiplierLevel, INFO_LEVEL.SHOP_INFO)}

### Unlocks at Ascension 6 ${ascensionLevel >= 6 ? '✅' : '❌'}

${getNuggieNuggieMultiplierInfo(nuggieNuggieMultiplierLevel, INFO_LEVEL.SHOP_INFO)}

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
