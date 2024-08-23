const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

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
**Gold Multiplier:** ${format(gold_multiplier, true)}x -> ${format(gold_multiplier + 0.4, true)}x
**Silver Multiplier:** ${format(silver_multiplier, true)}x -> ${format(silver_multiplier + 0.2, true)}x
**Bronze Multiplier:** ${format(bronze_multiplier, true)}x -> ${format(bronze_multiplier + 0.1, true)}x
**Cost:** ${format(multiplier_amount_cost)} mystic credits
Buy with \`/buy 1\`

### Multiplier Rarity Upgrade
**Level:** ${multiplier_rarity_level} -> ${multiplier_rarity_level + 1}
**Gold Chance:** ${format(gold_chance * 100, true)}% -> ${format(gold_chance * 100 + 0.5, true)}%
**Silver Chance:** ${format(silver_chance * 100, true)}% -> ${format(silver_chance * 100 + 1, true)}%
**Bronze Chance:** ${format(bronze_chance * 100, true)}% -> ${format(bronze_chance * 100 + 2, true)}%
**Cost:** ${format(multiplier_rarity_cost)} mystic credits
Buy with \`/buy 2\`

### Beki Upgrade
**Level:** ${beki_level} -> ${beki_level + 1}
**Cooldown:** ${format(cooldown, true)} hours -> ${format(cooldown * 0.95, true)} hours
**Cost:** ${format(beki_cost)} mystic credits
Buy with \`/buy 3\``)
        ]});
    }
}

module.exports = Upgrades;