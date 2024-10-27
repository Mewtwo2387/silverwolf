const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { getMultiplierAmount, getMultiplierChance, getBekiCooldown, getNextUpgradeCost, getTotalUpgradeCost } = require('../utils/upgrades.js');

class UpgradeData extends Command{
    constructor(client){
        super(client, "upgradedata", "check stats at a certain level",
            [{
                name: "level",
                description: "level",
                type: 4,
                required: true
            }]
        );
    }

    async run(interaction){
        const level = interaction.options.getInteger('level');
        const multiplier_amount = getMultiplierAmount(level);
        const multiplier_amount_next = getMultiplierAmount(level + 1);
        const multiplier_rarity = getMultiplierChance(level);
        const multiplier_rarity_next = getMultiplierChance(level + 1);
        const beki_cooldown = getBekiCooldown(level);
        const beki_cooldown_next = getBekiCooldown(level + 1);
        const cost = getNextUpgradeCost(level);
        const cost_total = getTotalUpgradeCost(level);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Upgrades')
            .setDescription(`### Multiplier Amount Upgrade
**Level:** ${level} -> ${(level + 1)}
**Gold Multiplier:** ${format(multiplier_amount.gold, true)}x -> ${format(multiplier_amount_next.gold, true)}x
**Silver Multiplier:** ${format(multiplier_amount.silver, true)}x -> ${format(multiplier_amount_next.silver, true)}x
**Bronze Multiplier:** ${format(multiplier_amount.bronze, true)}x -> ${format(multiplier_amount_next.bronze, true)}x
**Cost for ${level} to ${level+1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(cost_total)} mystic credits

### Multiplier Rarity Upgrade
**Level:** ${level} -> ${level + 1}
**Gold Chance:** ${format(multiplier_rarity.gold * 100, true)}% -> ${format(multiplier_rarity_next.gold * 100 + 0.5, true)}%
**Silver Chance:** ${format(multiplier_rarity.silver * 100, true)}% -> ${format(multiplier_rarity_next.silver * 100 + 1, true)}%
**Bronze Chance:** ${format(multiplier_rarity.bronze * 100, true)}% -> ${format(multiplier_rarity_next.bronze * 100 + 2, true)}%
**Cost for ${level} to ${level+1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(cost_total)} mystic credits

### Beki Upgrade
**Level:** ${level} -> ${level + 1}
**Cooldown:** ${format(beki_cooldown, true)} hours -> ${format(beki_cooldown_next, true)} hours
**Cost for ${level} to ${level+1}:** ${format(cost)} mystic credits
**Cost for 1 to ${level}:** ${format(cost_total)} mystic credits`)
        ]});
    }
}

module.exports = UpgradeData;