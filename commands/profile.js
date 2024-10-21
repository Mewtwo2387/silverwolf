const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { getMaxLevel, getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades.js');
const { getNuggieFlatMultiplier, getNuggieStreakMultiplier } = require('../utils/ascensionupgrades.js');
const marriageBenefits = require('../utils/marriageBenefits.js');

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
        let avatarURL;
        let pokemons;
        if (interaction.options.getMember('user')) {
            // Get the specified user's data
            user = await this.client.db.getUser(interaction.options.getMember('user').id);
            const discordUser = await this.client.users.fetch(user.id);
            username = discordUser.username;
            avatarURL = discordUser.displayAvatarURL({ dynamic: true, size: 512 });
            pokemons = await this.client.db.getPokemons(interaction.options.getMember('user').id);
        } else {
            // Get the interaction user's data
            user = await this.client.db.getUser(interaction.user.id);
            username = interaction.user.username;
            avatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 512 });
            pokemons = await this.client.db.getPokemons(interaction.user.id);
        }
        const multiplier_amount = getMultiplierAmount(user.multiplier_amount_level);
        const multiplier_rarity = getMultiplierChance(user.multiplier_rarity_level);
        const beki_cooldown = getBekiCooldown(user.beki_level) * 60 * 60;
        const nuggie_flat_multiplier = getNuggieFlatMultiplier(user.nuggie_flat_multiplier_level);
        const nuggie_streak_multiplier = getNuggieStreakMultiplier(user.nuggie_streak_multiplier_level);
        const next_claim = beki_cooldown - (Date.now() - user.dinonuggies_last_claimed) / 1000;
        pokemons.sort((a, b) => a.pokemon_name.localeCompare(b.pokemon_name));
        const maxNameLength = Math.max(...pokemons.map(pokemon => pokemon.pokemon_name.length));
        const pokemon_list = pokemons.map(pokemon =>
            `${pokemon.pokemon_name.padEnd(maxNameLength + 2)} ${pokemon.pokemon_count}`
        ).join('\n')

        const embed = new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`${username}'s Profile`)
            .setThumbnail(avatarURL)
            .setDescription(`
## Currency
**Mystic Credits:** ${format(user.credits, true)}
**Bitcoin:** ${user.bitcoin}
**Dinonuggies:** ${format(user.dinonuggies)}
**Heavenly Nuggies:** ${format(user.heavenly_nuggies)}

## Levels
**Ascension Level:** Level ${user.ascension_level}
**Max Upgrade Level:** ${getMaxLevel(user.ascension_level)}

**Multiplier Amount Upgrade:** Level ${user.multiplier_amount_level}/${getMaxLevel(user.multiplier_amount_level)}
**Gold Multiplier:** ${format(multiplier_amount.gold, true)}x
**Silver Multiplier:** ${format(multiplier_amount.silver, true)}x
**Bronze Multiplier:** ${format(multiplier_amount.bronze, true)}x

**Multiplier Rarity Upgrade:** Level ${user.multiplier_rarity_level}/${getMaxLevel(user.multiplier_rarity_level)}
**Gold Chance:** ${format(multiplier_rarity.gold * 100, true)}%
**Silver Chance:** ${format(multiplier_rarity.silver * 100, true)}%
**Bronze Chance:** ${format(multiplier_rarity.bronze * 100, true)}%

**Beki Upgrade:** Level ${user.beki_level}/${getMaxLevel(user.beki_level)}
**Beki Cooldown:** ${format(beki_cooldown)}h

**Nuggie Flat Multiplier Upgrade:** Level ${user.nuggie_flat_multiplier_level}/${getMaxLevel(user.nuggie_flat_multiplier_level)}
**Nuggie Flat Multiplier:** ${format(nuggie_flat_multiplier)}x

**Nuggie Streak Multiplier Upgrade:** Level ${user.nuggie_streak_multiplier_level}/${getMaxLevel(user.nuggie_streak_multiplier_level)}
**Nuggie Streak Multiplier:** ${format(nuggie_streak_multiplier * 100)}%/day

## Claims
**Current Streak:** ${user.dinonuggies_claim_streak} days
**Base Claim Amount:** 5 + ${format(user.dinonuggies_claim_streak)} = ${format(5 + user.dinonuggies_claim_streak)}
**Multiplier From Streak:** 1 + ${format(nuggie_streak_multiplier, true)} * ${format(user.dinonuggies_claim_streak)} = ${format(1 + nuggie_streak_multiplier * user.dinonuggies_claim_streak, true)}x
**Flat Multiplier:** ${format(nuggie_flat_multiplier, true)}x
**Marriage Multiplier:** ${format(await marriageBenefits(this.client, user.id), true)}x
**Next Claim:** ${next_claim > 0 ? `${(next_claim / 60 / 60).toFixed(0)}h ${(next_claim / 60 % 60).toFixed(0)}m ${(next_claim % 60).toFixed(0)}s` : "Ready"}

## Gambling
### Slots
**Times Played:** ${user.slots_times_played}
**Times Won:** ${user.slots_times_won}
**Percentage Won:** ${format(user.slots_times_played > 0 ? (user.slots_times_won / user.slots_times_played * 100) : 0, true)}%
**Amount Gambled:** ${format(user.slots_amount_gambled)}
**Amount Won:** ${format(user.slots_amount_won)} 
**Net Winnings:** ${format(user.slots_amount_won - user.slots_amount_gambled)}
**Relative Amount Won:** ${format(user.slots_relative_won, true)} bets
**Relative Net Winnings:** ${format(user.slots_relative_won - user.slots_times_played, true)} bets

### Blackjack
**Times Played:** ${user.blackjack_times_played}
**Times Won:** ${user.blackjack_times_won}
**Times Drew:** ${user.blackjack_times_drawn}
**Times Lost:** ${user.blackjack_times_lost}
**Percentage Won (Excluding Draws):** ${format((user.blackjack_times_won + user.blackjack_times_lost) > 0 ? (user.blackjack_times_won / (user.blackjack_times_won + user.blackjack_times_lost) * 100) : 0, true)}%
**Amount Gambled:** ${format(user.blackjack_amount_gambled)}
**Amount Won:** ${format(user.blackjack_amount_won)} 
**Net Winnings:** ${format(user.blackjack_amount_won - user.blackjack_amount_gambled)}
**Relative Amount Won:** ${format(user.blackjack_relative_won, true)} bets
**Relative Net Winnings:** ${format(user.blackjack_relative_won - user.blackjack_times_played, true)} bets

### Roulette
**Times Played:** ${user.roulette_times_played}
**Times Won:** ${user.roulette_times_won}
**Percentage Won:** ${format(user.roulette_times_played > 0 ? (user.roulette_times_won / user.roulette_times_played * 100) : 0, true)}%
**Amount Gambled:** ${format(user.roulette_amount_gambled)}
**Amount Won:** ${format(user.roulette_amount_won)} 
**Net Winnings:** ${format(user.roulette_amount_won - user.roulette_amount_gambled)}
**Relative Amount Won:** ${format(user.roulette_relative_won, true)} bets
**Relative Net Winnings:** ${format(user.roulette_relative_won - user.roulette_times_played, true)} bets

## Others
**Pity:** ${user.pity}
**Birthday:** ${user.birthdays ? user.birthdays : "No birthday set"}
**Pokemons:** \`\`\`${pokemon_list}\`\`\`
            `)
            .setTimestamp()
            .setFooter({ text: `ID: ${user.id}` });
        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = Profile;