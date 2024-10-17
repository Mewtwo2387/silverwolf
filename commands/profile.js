const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { getMaxLevel, getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades.js');
const { getNuggieFlatMultiplier, getNuggieStreakMultiplier } = require('../utils/ascensionupgrades.js');

class Profile extends Command {
    constructor(client){
        super(client, "profile", "check profile", [
            {
                name: 'user',
                description: 'the user to check',
                type: 6,
                required: false
            }
        ]);
    }

    async run(interaction){
        let user;
        let username;
        if (interaction.options.getMember('user')){
            user = await this.client.db.getUser(interaction.options.getMember('user').id);
            const discordUser = await this.client.users.fetch(user.id);
            username = discordUser.username;
        } else {
            user = await this.client.db.getUser(interaction.user.id);
            username = interaction.user.username;
        }
        const multiplier_amount = getMultiplierAmount(user.multiplier_amount_level);
        const multiplier_rarity = getMultiplierChance(user.multiplier_rarity_level);
        const beki_cooldown = getBekiCooldown(user.beki_level);
        const nuggie_flat_multiplier = getNuggieFlatMultiplier(user.nuggie_flat_multiplier_level);
        const nuggie_streak_multiplier = getNuggieStreakMultiplier(user.nuggie_streak_multiplier_level);
        const next_claim = beki_cooldown - (Date.now() - user.dinonuggies_last_claimed) / 1000;
        const pokemons = await this.client.db.getPokemons(interaction.user.id);
        pokemons.sort((a, b) => a.pokemon_name.localeCompare(b.pokemon_name));
        const maxNameLength = Math.max(...pokemons.map(pokemon => pokemon.pokemon_name.length));
        const pokemon_list = pokemons.map(pokemon =>
            `${pokemon.pokemon_name.padEnd(maxNameLength + 2)} ${pokemon.pokemon_count}`
        ).join('\n')

        const embed = new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`${username}'s Profile`)
            .addFields(
                { name: 'Mystic Credits', value: `${format(user.credits)}`, inline: true },
                { name: 'Bitcoin', value: `${user.bitcoin}`, inline: true },
                { name: 'Dinonuggies', value: `${format(user.dinonuggies)}`, inline: true },
                { name: 'Heavenly Nuggies', value: `${format(user.heavenly_nuggies)}`, inline: true },
                { name: 'Ascension Level', value: `${user.ascension_level} (Max Upgrade Level: ${getMaxLevel(user.ascension_level)})`, inline: true },
                { name: 'Multiplier Amount Upgrade', value: `Level ${user.multiplier_amount_level}/${getMaxLevel(user.multiplier_amount_level)}
                **Gold Multiplier:** ${format(multiplier_amount.gold, true)}x
                **Silver Multiplier:** ${format(multiplier_amount.silver, true)}x
                **Bronze Multiplier:** ${format(multiplier_amount.bronze, true)}x`, inline: true },
                { name: 'Multiplier Rarity Upgrade', value: `Level ${user.multiplier_rarity_level}/${getMaxLevel(user.multiplier_rarity_level)}
                **Gold Chance:** ${format(multiplier_rarity.gold * 100, true)}%
                **Silver Chance:** ${format(multiplier_rarity.silver * 100, true)}%
                **Bronze Chance:** ${format(multiplier_rarity.bronze * 100, true)}%`, inline: true },
                { name: 'Beki Upgrade', value: `Level ${user.beki_level}/${getMaxLevel(user.beki_level)}
                **Beki Cooldown:** ${format(beki_cooldown)}h`, inline: true },
                { name: 'Nuggie Flat Multiplier Upgrade', value: `Level ${user.nuggie_flat_multiplier_level}/${getMaxLevel(user.nuggie_flat_multiplier_level)}
                **Nuggie Flat Multiplier:** ${format(nuggie_flat_multiplier)}x`, inline: true },
                { name: 'Nuggie Streak Multiplier Upgrade', value: `Level ${user.nuggie_streak_multiplier_level}/${getMaxLevel(user.nuggie_streak_multiplier_level)}
                **Nuggie Streak Multiplier:** ${format(nuggie_streak_multiplier * 100)}%/day`, inline: true },
                { name: 'Current Streak', value: `${user.dinonuggies_claim_streak} days
                **Base Claim Amount:** 5 + ${format(user.dinonuggies_claim_streak)} = ${format(5 + user.dinonuggies_claim_streak)}
                **Multiplier From Streak:** 1 + ${format(nuggie_streak_multiplier, true)} * ${format(user.dinonuggies_claim_streak)} = ${format(1 + nuggie_streak_multiplier * user.dinonuggies_claim_streak, true)}x`, inline: true },
                { name: 'Next Claim', value: `${next_claim > 0 ? `\`\`\`${format(next_claim / 60 / 60)}h ${format((next_claim / 60) % 60)}m ${format(next_claim % 60)}s\`\`\`` : "Ready"}`, inline: true },
                { name: 'Pity', value: `${user.pity}`, inline: true }, 
                { name: 'Birthday', value: `${user.birthdays ? user.birthdays : "No birthday set"}`, inline: true },
                { name: 'Pokemons', value: `\`\`\`${pokemon_list}\`\`\``, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${user.id}` });
        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = Profile;