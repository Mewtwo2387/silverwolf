const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class Upgrades extends Command{
    constructor(client){
        super(client, "upgrades", "upgrade your dinonuggie multipliers", []);
    }

    async run(interaction){
        const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
        const multiplier_rarity_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
        const beki_level = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');
        const bronze_multiplier = 1.4 + 0.1 * multiplier_amount_level;
        const silver_multiplier = 1.8 + 0.2 * multiplier_amount_level;
        const gold_multiplier = 2.6 + 0.4 * multiplier_amount_level;
        const gold_chance = 0.025 + 0.005 * multiplier_rarity_level;
        const silver_chance = 0.05 + 0.01 * multiplier_rarity_level;
        const bronze_chance = 0.1 + 0.02 * multiplier_rarity_level;
        const multiplier_amount_cost = 5000 * multiplier_amount_level;
        const multiplier_rarity_cost = 5000 * multiplier_rarity_level;
        const cooldown = 24 * Math.pow(0.95, beki_level - 1);
        const beki_cost = 5000 * beki_level;
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Upgrades')
            .setDescription(`### Multiplier Amount Upgrade
**Level:** ${multiplier_amount_level} -> ${(multiplier_amount_level + 1)}
**Gold Multiplier:** ${gold_multiplier.toFixed(2)}x -> ${(gold_multiplier + 0.4).toFixed(2)}x
**Silver Multiplier:** ${silver_multiplier.toFixed(2)}x -> ${(silver_multiplier + 0.2).toFixed(2)}x
**Bronze Multiplier:** ${bronze_multiplier.toFixed(2)}x -> ${(bronze_multiplier + 0.1).toFixed(2)}x
**Cost:** ${multiplier_amount_cost.toFixed(2)} mystic credits
Buy with \`/buy 1\`

### Multiplier Rarity Upgrade
**Level:** ${multiplier_rarity_level} -> ${multiplier_rarity_level + 1}
**Gold Chance:** ${(gold_chance * 100).toFixed(2)}% -> ${(gold_chance * 100 + 0.5).toFixed(2)}%
**Silver Chance:** ${(silver_chance * 100).toFixed(2)}% -> ${(silver_chance * 100 + 1).toFixed(2)}%
**Bronze Chance:** ${(bronze_chance * 100).toFixed(2)}% -> ${(bronze_chance * 100 + 2).toFixed(2)}%
**Cost:** ${multiplier_rarity_cost.toFixed(2)} mystic credits
Buy with \`/buy 2\`

### Beki Upgrade
**Level:** ${beki_level} -> ${beki_level + 1}
**Cooldown:** ${cooldown.toFixed(2)}hrs -> ${(cooldown * 0.95).toFixed(2)}hrs
**Cost:** ${beki_cost.toFixed(2)} mystic credits
Buy with \`/buy 3\``)
        ]});
    }
}

module.exports = Upgrades;