const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { getNextUpgradeCost, getTotalUpgradeCost, getMultiplierAmount, getMultiplierChance, getBekiCooldown, getMaxLevel } = require('../utils/upgrades.js');

class Upgrades extends Command{
    constructor(client){
        super(client, "upgrades", "upgrade your dinonuggie multipliers", []);
    }

    async run(interaction){
        const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');
        const max_level = getMaxLevel(ascensionLevel);

        const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
        const multiplier_rarity_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
        const beki_level = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');

        const multiplier_amount = getMultiplierAmount(multiplier_amount_level);
        const multipler_amount_next = getMultiplierAmount(Math.min(multiplier_amount_level + 1, max_level));
        const multiplier_rarity = getMultiplierChance(multiplier_rarity_level);
        const multiplier_rarity_next = getMultiplierChance(Math.min(multiplier_rarity_level + 1, max_level));
        const cooldown = getBekiCooldown(beki_level);
        const cooldown_next = getBekiCooldown(Math.min(beki_level + 1, max_level));

        const multiplier_amount_cost = getNextUpgradeCost(multiplier_amount_level);
        const multiplier_rarity_cost = getNextUpgradeCost(multiplier_rarity_level);
        const beki_cost = getNextUpgradeCost(beki_level);

        var desc = "### Multiplier Amount Upgrade\n";
        if (multiplier_amount_level < max_level){
            desc += `**Level:** ${multiplier_amount_level}/${max_level} -> ${(multiplier_amount_level + 1)}/${max_level}
**Gold Multiplier:** ${format(multiplier_amount.gold, true)}x -> ${format(multipler_amount_next.gold, true)}x
**Silver Multiplier:** ${format(multiplier_amount.silver, true)}x -> ${format(multipler_amount_next.silver, true)}x
**Bronze Multiplier:** ${format(multiplier_amount.bronze, true)}x -> ${format(multipler_amount_next.bronze, true)}x
**Cost:** ${format(multiplier_amount_cost)} mystic credits
Buy with \`/buy upgrades 1\``;
        }else{
            desc += `**Level:** ${multiplier_amount_level} (maxed)
**Gold Multiplier:** ${format(multiplier_amount.gold, true)}x
**Silver Multiplier:** ${format(multiplier_amount.silver, true)}x
**Bronze Multiplier:** ${format(multiplier_amount.bronze, true)}x`;
        }

        desc += "\n\n### Multiplier Rarity Upgrade\n";
        if (multiplier_rarity_level < max_level){
            desc += `**Level:** ${multiplier_rarity_level}/${max_level} -> ${(multiplier_rarity_level + 1)}/${max_level}
**Gold Chance:** ${format(multiplier_rarity.gold * 100, true)}% -> ${format(multiplier_rarity_next.gold * 100, true)}%
**Silver Chance:** ${format(multiplier_rarity.silver * 100, true)}% -> ${format(multiplier_rarity_next.silver * 100, true)}%
**Bronze Chance:** ${format(multiplier_rarity.bronze * 100, true)}% -> ${format(multiplier_rarity_next.bronze * 100, true)}%
**Cost:** ${format(multiplier_rarity_cost)} mystic credits
Buy with \`/buy upgrades 2\``;
        }else{
            desc += `**Level:** ${multiplier_rarity_level} (maxed)
**Gold Chance:** ${format(multiplier_rarity.gold * 100, true)}%
**Silver Chance:** ${format(multiplier_rarity.silver * 100, true)}%
**Bronze Chance:** ${format(multiplier_rarity.bronze * 100, true)}%`;
        }

        desc += "\n\n### Beki Upgrade\n";
        if (beki_level < max_level){
            desc += `**Level:** ${beki_level}/${max_level} -> ${(beki_level + 1)}/${max_level}
**Cooldown:** ${format(cooldown, true)} hours -> ${format(cooldown_next, true)} hours
**Cost:** ${format(beki_cost)} mystic credits
Buy with \`/buy upgrades 3\``;
        }else{
            desc += `**Level:** ${beki_level} (maxed)
**Cooldown:** ${format(cooldown, true)} hours`;
        }

        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Upgrades')
            .setDescription(desc)
        ]});
    }
}

module.exports = Upgrades;