const { format } = require('../utils/math.js');
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { getNextUpgradeCost, getTotalUpgradeCost, getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades.js');

const UPGRADES = ['multiplier_amount', 'multiplier_rarity', 'beki'];

// We don't talk about the spaghetti code here

class Buy extends Command{
    constructor(client){
        super(client, "buy", "buy upgrades", [
            {
                name: "upgrade",
                description: "The upgrade to buy",
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');
        const max_level = getMaxLevel(ascensionLevel);

        const upgradeId = interaction.options.getInteger('upgrade');

        if (upgradeId < 1 || upgradeId > UPGRADES.length){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('Invalid upgrade')
                .setFooter({ text : 'dinonuggie'})
            ]});
            return;
        }

        const upgrade = UPGRADES[upgradeId - 1];

        const level = await this.client.db.getUserAttr(interaction.user.id, `${upgrade}_level`);

        if (level >= max_level){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('Upgrade maxed')
                .setDescription(`how far do you even want to go`)
                .setFooter({ text : 'increase the cap by ascending'})
            ]});
            return;
        }

        const cost = getNextUpgradeCost(level);
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');

        if (credits < cost){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('You dont have enough mystic credits')
                .setDescription(`You have ${format(credits)} mystic credits, but you need ${format(cost)} to buy the upgrade`)
                .setFooter({ text : 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin'})
            ]});
            return;
        }

        await this.client.db.addUserAttr(interaction.user.id, 'credits', -cost);
        await this.client.db.addUserAttr(interaction.user.id, `${upgrade}_level`, 1);

        switch(upgrade){
            case 'multiplier_amount':
                const multiplierAmount = getMultiplierAmount(level);
                const nextMultiplierAmount = getMultiplierAmount(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Multiplier Amount Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
Gold Multiplier: ${format(multiplierAmount.gold, true)}x -> ${format(nextMultiplierAmount.gold, true)}x
Silver Multiplier: ${format(multiplierAmount.silver, true)}x -> ${format(nextMultiplierAmount.silver, true)}x
Bronze Multiplier: ${format(multiplierAmount.bronze, true)}x -> ${format(nextMultiplierAmount.bronze, true)}x
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
            case 'multiplier_rarity':
                const multiplierRarity = getMultiplierChance(level);
                const nextMultiplierRarity = getMultiplierChance(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Multiplier Rarity Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
Gold Chance: ${format(multiplierRarity.gold * 100, true)}% -> ${format(nextMultiplierRarity.gold * 100, true)}%
Silver Chance: ${format(multiplierRarity.silver * 100, true)}% -> ${format(nextMultiplierRarity.silver * 100, true)}%
Bronze Chance: ${format(multiplierRarity.bronze * 100, true)}% -> ${format(nextMultiplierRarity.bronze * 100, true)}%
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
            case 'beki':
                const cooldown = getBekiCooldown(level);
                const nextCooldown = getBekiCooldown(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Beki Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
Cooldown: ${format(cooldown, true)}hrs -> ${format(nextCooldown, true)}hrs
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
        }
    }
}

module.exports = Buy;