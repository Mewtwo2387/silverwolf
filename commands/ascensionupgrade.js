const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNextAscensionUpgradeCost } = require('../utils/ascensionupgrades.js');

class AscensionUpgrade extends Command{
    constructor(client){
        super(client, "ascensionupgrade", "buy strong upgrades with your heavenly nuggies", []);
    }

    async run(interaction){
        const nuggie_flat_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_flat_multiplier_level');
        const nuggie_streak_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_streak_multiplier_level');

        const nuggie_flat_multiplier = getNuggieFlatMultiplier(nuggie_flat_multiplier_level);
        const nuggie_flat_multiplier_next = getNuggieFlatMultiplier(nuggie_flat_multiplier_level + 1);
        const nuggie_streak_multiplier = getNuggieStreakMultiplier(nuggie_streak_multiplier_level);
        const nuggie_streak_multiplier_next = getNuggieStreakMultiplier(nuggie_streak_multiplier_level + 1);

        const nuggie_flat_multiplier_cost = getNextAscensionUpgradeCost(nuggie_flat_multiplier_level);
        const nuggie_streak_multiplier_cost = getNextAscensionUpgradeCost(nuggie_streak_multiplier_level);

        var desc = `### Nuggie Flat Multiplier Upgrade
Applies a flat multiplier to all claims.
**Level:** ${nuggie_flat_multiplier_level} -> ${nuggie_flat_multiplier_level + 1}
**Multiplier:** ${format(nuggie_flat_multiplier)}x -> ${format(nuggie_flat_multiplier_next)}x
**Cost:** ${format(nuggie_flat_multiplier_cost)} heavenly nuggies
Buy with \`/buyascension 1\`

### Nuggie Streak Multiplier Upgrade
Applies a multiplier to all claims based on your current streak.
**Level:** ${nuggie_streak_multiplier_level} -> ${nuggie_streak_multiplier_level + 1}
**Multiplier:** +${format(nuggie_streak_multiplier * 100)}%/day -> +${format(nuggie_streak_multiplier_next * 100)}%/day
**Cost:** ${format(nuggie_streak_multiplier_cost)} heavenly nuggies
Buy with \`/buyascension 2\``;

        const embed = new Discord.EmbedBuilder()
            .setTitle("Ascension Upgrades")
            .setDescription(desc)
            .setColor(0x0099ff);

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = AscensionUpgrade;
