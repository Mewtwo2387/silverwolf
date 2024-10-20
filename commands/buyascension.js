const { format } = require('../utils/math.js');
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier, getNextAscensionUpgradeCost } = require('../utils/ascensionupgrades.js');

const ASCENSION_UPGRADES = [
    'nuggie_flat_multiplier',
    'nuggie_streak_multiplier',
    'nuggie_credits_multiplier'
];

class BuyAscension extends Command{
    constructor(client){
        super(client, "buyascension", "buy ascension upgrades", [
            {
                name: "upgrade",
                description: "The upgrade to buy",
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        const upgradeId = interaction.options.getInteger('upgrade');

        if (upgradeId < 1 || upgradeId > ASCENSION_UPGRADES.length){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('Invalid upgrade')
                .setFooter({ text : 'dinonuggie'})
            ]});
            return;
        }

        const upgrade = ASCENSION_UPGRADES[upgradeId - 1];

        const level = await this.client.db.getUserAttr(interaction.user.id, `${upgrade}_level`);

        const amplifier = {
            'nuggie_flat_multiplier': 1,
            'nuggie_streak_multiplier': 1,
            'nuggie_credits_multiplier': 3
        };
        const cost = getNextAscensionUpgradeCost(level, amplifier[upgrade]);
        const heavenly_nuggies = await this.client.db.getUserAttr(interaction.user.id, 'heavenly_nuggies');

        if (heavenly_nuggies < cost){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('You dont have enough heavenly nuggies')
                .setDescription(`You have ${format(heavenly_nuggies)} heavenly nuggies, but you need ${format(cost)} to buy the upgrade`)
                .setFooter({ text : 'heavenly nuggies can be obtained by /ascend'})
            ]});
            return;
        }

        await this.client.db.addUserAttr(interaction.user.id, 'heavenly_nuggies', -cost);
        await this.client.db.addUserAttr(interaction.user.id, `${upgrade}_level`, 1);

        switch(upgrade){
            case 'nuggie_flat_multiplier':
                const nuggie_flat_multiplier = getNuggieFlatMultiplier(level);
                const next_nuggie_flat_multiplier = getNuggieFlatMultiplier(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Nuggie Flat Multiplier Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
Nuggie Flat Multiplier: ${format(nuggie_flat_multiplier)}x -> ${format(next_nuggie_flat_multiplier)}x
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
            case 'nuggie_streak_multiplier':
                const nuggie_streak_multiplier = getNuggieStreakMultiplier(level);
                const next_nuggie_streak_multiplier = getNuggieStreakMultiplier(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Nuggie Streak Multiplier Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
**Multiplier:** +${format(nuggie_streak_multiplier * 100)}%/day -> +${format(next_nuggie_streak_multiplier * 100)}%/day
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
            case 'nuggie_credits_multiplier':
                const nuggie_credits_multiplier = getNuggieCreditsMultiplier(level);
                const next_nuggie_credits_multiplier = getNuggieCreditsMultiplier(level + 1);
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Nuggie Credits Multiplier Upgrade Bought')
                    .setDescription(`Level: ${level} -> ${level + 1}
**Multiplier:** +${format(nuggie_credits_multiplier * 100)}% * log2(credits) -> +${format(next_nuggie_credits_multiplier * 100)}% * log2(credits)
Heavenly Nuggies: ${format(heavenly_nuggies)} -> ${format(heavenly_nuggies - cost)}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
                break;
        }
    }
}

module.exports = BuyAscension;