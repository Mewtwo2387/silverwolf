const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

class Upgrades extends Command{
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
        const bronze_multiplier = 1.4 + 0.1 * level;
        const silver_multiplier = 1.8 + 0.2 * level;
        const gold_multiplier = 2.6 + 0.4 * level;
        const gold_chance = 0.025 + 0.005 * level;
        const silver_chance = 0.05 + 0.01 * level;
        const bronze_chance = 0.1 + 0.02 * level;
        const multiplier_amount_cost = 5000 * level;
        const multiplier_rarity_cost = 5000 * level;
        const cooldown = 24 * Math.pow(0.95, level - 1);
        const beki_cost = 5000 * level;
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Upgrades')
            .setDescription(`### Multiplier Amount Upgrade
**Level:** ${level} -> ${(level + 1)}
**Gold Multiplier:** ${format(gold_multiplier, true)}x -> ${format(gold_multiplier + 0.4, true)}x
**Silver Multiplier:** ${format(silver_multiplier, true)}x -> ${format(silver_multiplier + 0.2, true)}x
**Bronze Multiplier:** ${format(bronze_multiplier, true)}x -> ${format(bronze_multiplier + 0.1, true)}x
**Cost for ${level} to ${level+1}:** ${format(multiplier_amount_cost)} mystic credits
**Cost for 1 to ${level}:** ${format(multiplier_amount_cost * (level - 1) / 2)} mystic credits

### Multiplier Rarity Upgrade
**Level:** ${level} -> ${level + 1}
**Gold Chance:** ${format(gold_chance * 100, true)}% -> ${format(gold_chance * 100 + 0.5, true)}%
**Silver Chance:** ${format(silver_chance * 100, true)}% -> ${format(silver_chance * 100 + 1, true)}%
**Bronze Chance:** ${format(bronze_chance * 100, true)}% -> ${format(bronze_chance * 100 + 2, true)}%
**Cost for ${level} to ${level+1}:** ${format(multiplier_rarity_cost)} mystic credits
**Cost for 1 to ${level}:** ${format(multiplier_rarity_cost * (level - 1) / 2)} mystic credits

### Beki Upgrade
**Level:** ${level} -> ${level + 1}
**Cooldown:** ${format(cooldown, true)} hours -> ${format(cooldown * 0.95, true)} hours
**Cost for ${level} to ${level+1}:** ${format(beki_cost)} mystic credits
**Cost for 1 to ${level}:** ${format(beki_cost * (level - 1) / 2)} mystic credits`)
        ]});
    }
}

module.exports = Upgrades;