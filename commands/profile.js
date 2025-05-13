const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const {
  getMaxLevel, getMultiplierAmount, getMultiplierChance, getBekiCooldown,
} = require('../utils/upgrades');
const {
  getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} = require('../utils/ascensionupgrades');
const marriageBenefits = require('../utils/marriageBenefits');

// Cooldown map
const cooldowns = new Map();
const COOLDOWN_DURATION = 60000; // Cooldown duration in milliseconds (e.g., 60 seconds)

class Profile extends Command {
  constructor(client) {
    super(client, 'profile', 'check profile', [
      {
        name: 'user',
        description: 'the user to check',
        type: 6,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    const userId = interaction.user.id;
    const currentTime = Date.now();

    // Check if the user is on cooldown
    if (cooldowns.has(userId)) {
      const lastUsed = cooldowns.get(userId);
      const timeSinceLastUse = currentTime - lastUsed;

      if (timeSinceLastUse < COOLDOWN_DURATION) {
        const timeLeft = ((COOLDOWN_DURATION - timeSinceLastUse) / 1000).toFixed(1);
        await interaction.editReply({ content: `Please wait ${timeLeft} seconds before using this command again.`, ephemeral: true });
        return;
      }
    }

    // Update the cooldown map
    cooldowns.set(userId, currentTime);
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

    // Calculations
    const multiplierAmount = getMultiplierAmount(user.multiplierAmountLevel);
    const multiplierRarity = getMultiplierChance(user.multiplierRarityLevel);
    const bekiCooldown = getBekiCooldown(user.bekiLevel) * 60 * 60;
    const nuggieFlatMultiplier = getNuggieFlatMultiplier(user.nuggieFlatMultiplierLevel);
    const nuggieStreakMultiplier = getNuggieStreakMultiplier(user.nuggieStreakMultiplierLevel);
    const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(user.nuggieCreditsMultiplierLevel);
    const nuggiePokemonMultiplier = getNuggiePokeMultiplier(user.nuggiePokemonMultiplierLevel);
    const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(user.nuggieNuggieMultiplierLevel);
    const { credits } = user;
    const log2Credits = credits > 1 ? Math.log2(credits) : 0;
    const pokemonCount = await this.client.db.getUniquePokemonCount(interaction.options.getMember('user') ? interaction.options.getMember('user').id : interaction.user.id);
    const log2Nuggies = user.dinonuggies > 1 ? Math.log2(user.dinonuggies) : 0;
    const nextClaim = bekiCooldown - (Date.now() - user.dinonuggiesLastClaimed) / 1000;
    pokemons.sort((a, b) => a.pokemon_name.localeCompare(b.pokemon_name));
    const maxNameLength = Math.max(...pokemons.map((pokemon) => pokemon.pokemon_name.length));
    const pokemonList = pokemons.map((pokemon) => `${pokemon.pokemonName.padEnd(maxNameLength + 2)} ${pokemon.pokemonCount}`).join('\n');
    const { ascensionLevel } = user;
    const maxLevel = getMaxLevel(ascensionLevel);

    // Create the initial embed
    const mainEmbed = new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription('Choose a category to view:')
      .setTimestamp();

    // Create a select menu for categories
    const categorySelect = new Discord.StringSelectMenuBuilder()
      .setCustomId('categorySelect')
      .setPlaceholder('Select a category')
      .addOptions([
        { label: 'Currency', value: 'currency' },
        { label: 'Levels', value: 'levels' },
        { label: 'Claims', value: 'claims' },
        { label: 'Gambling', value: 'gambling' },
        { label: 'Others', value: 'others' },
        { label: 'Pokemons', value: 'pokemons' },
      ]);

    // Create an action row for the select menu
    const actionRow = new Discord.ActionRowBuilder().addComponents(categorySelect);

    // Send the initial message
    await interaction.editReply({ embeds: [mainEmbed], components: [actionRow] });

    // Create a filter for interaction
    const filter = (i) => i.customId === 'categorySelect' && i.user.id === interaction.user.id;

    // Set up a collector with a timeout of 60 seconds
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      await i.deferUpdate(); // Acknowledge the interaction

      let detailsEmbed;

      // Display details based on the selected category
      switch (i.values[0]) {
        case 'currency':
          detailsEmbed = this.createCurrencyEmbed(credits, user, username, avatarURL);
          break;
        case 'levels':
          detailsEmbed = this.createLevelsEmbed(user, ascension_level, max_level, multiplier_amount, multiplier_rarity, beki_cooldown, nuggie_flat_multiplier, nuggie_streak_multiplier, nuggie_credits_multiplier, log2_credits, username, avatarURL, nuggie_pokemon_multiplier, nuggie_nuggie_multiplier);
          break;
        case 'claims':
          detailsEmbed = await this.createClaimsEmbed(user, next_claim, nuggie_streak_multiplier, nuggie_flat_multiplier, nuggie_credits_multiplier, log2_credits, username, avatarURL, pokemon_count, log2_nuggies, nuggie_pokemon_multiplier, nuggie_nuggie_multiplier);
          break;
        case 'gambling':
          detailsEmbed = this.createGamblingEmbed(user, username, avatarURL);
          break;
        case 'others':
          detailsEmbed = this.createOthersEmbed(user, username, avatarURL);
          break;
        case 'pokemons':
          detailsEmbed = this.createPokemonsEmbed(pokemon_list, username, avatarURL);
          break;
        default:
          break;
      }

      // Edit the main embed to show the selected details while keeping the select menu
      await interaction.editReply({ embeds: [detailsEmbed], components: [actionRow] });
    });

    collector.on('end', async (collected) => {
      // Disable the embed after timeout
      if (collected.size === 0) {
        await interaction.editReply({ content: 'The selection timed out.', components: [] });
      }
    });
  }

  // Helper methods to create category embeds
  createCurrencyEmbed(credits, user, username, avatarURL) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
## Currency
**Mystic Credits:** ${format(credits, true)}
**Bitcoin:** ${user.bitcoin}
**Dinonuggies:** ${format(user.dinonuggies)}
**Heavenly Nuggies:** ${format(user.heavenly_nuggies)}
            `)
      .setTimestamp();
  }

  createLevelsEmbed(user, ascensionLevel, maxLevel, multiplierAmount, multiplierRarity, bekiCooldown, nuggieFlatMultiplier, nuggieStreakMultiplier, nuggieCreditsMultiplier, log2Credits, username, avatarURL, nuggiePokemonMultiplier, nuggieNuggieMultiplier) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
## Levels
**Ascension Level:** Level ${ascensionLevel}
**Max Upgrade Level:** ${maxLevel}

**Multiplier Amount Upgrade:** Level ${user.multiplier_amount_level}/${max_level}
**Gold Multiplier:** ${format(multiplierAmount.gold, true)}x
**Silver Multiplier:** ${format(multiplierAmount.silver, true)}x
**Bronze Multiplier:** ${format(multiplierAmount.bronze, true)}x

**Multiplier Rarity Upgrade:** Level ${user.multiplierRarityLevel}/${maxLevel}
**Gold Chance:** ${format(multiplierRarity.gold * 100, true)}%
**Silver Chance:** ${format(multiplierRarity.silver * 100, true)}%
**Bronze Chance:** ${format(multiplierRarity.bronze * 100, true)}%

**Beki Upgrade:** Level ${user.bekiLevel}/${maxLevel}
**Beki Cooldown:** ${format(bekiCooldown)}s (${format(bekiCooldown / 60 / 60, true)}h)

**Nuggie Flat Multiplier Upgrade:** Level ${user.nuggieFlatMultiplierLevel}
**Nuggie Flat Multiplier:** ${format(nuggieFlatMultiplier)}x

**Nuggie Streak Multiplier Upgrade:** Level ${user.nuggieStreakMultiplierLevel}
**Nuggie Streak Multiplier:** ${format(nuggieStreakMultiplier * 100)}%/day

**Nuggie Credits Multiplier Upgrade:** Level ${user.nuggieCreditsMultiplierLevel}
**Nuggie Credits Multiplier:** ${format(nuggieCreditsMultiplier * 100)}% * log2(credits)

**Nuggie Pokemon Multiplier Upgrade:** Level ${user.nuggiePokemonMultiplierLevel}
**Nuggie Pokemon Multiplier:** ${format(nuggiePokemonMultiplier * 100)}% * pokemonCount

**Nuggie Nuggie Multiplier Upgrade:** Level ${user.nuggieNuggieMultiplierLevel}
**Nuggie Nuggie Multiplier:** ${format(nuggieNuggieMultiplier * 100)}% * log2(nuggies)
            `)
      .setTimestamp();
  }

  async createClaimsEmbed(user, nextClaim, nuggieStreakMultiplier, nuggieFlatMultiplier, nuggieCreditsMultiplier, log2Credits, username, avatarURL, pokemonCount, log2Nuggies, nuggiePokemonMultiplier, nuggieNuggieMultiplier) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
    ## Claims
    **Current Streak:** ${user.dinonuggies_claim_streak} days
    **Base Claim Amount:** 5 + ${format(user.dinonuggiesClaimStreak)} = ${format(5 + user.dinonuggiesClaimStreak)}
    **Streak Multiplier:** 1 + ${format(nuggieStreakMultiplier, true)} * ${format(user.dinonuggiesClaimStreak)} = ${format(1 + nuggieStreakMultiplier * user.dinonuggiesClaimStreak, true)}x
    **Flat Multiplier:** ${format(nuggieFlatMultiplier, true)}x
    **Marriage Multiplier:** ${format(await marriageBenefits(this.client, user.id), true)}x
    **Credits Multiplier:** 1 + ${format(nuggieCreditsMultiplier, true)} * ${format(log2Credits, true)} = ${format(1 + nuggieCreditsMultiplier * log2Credits, true)}x
    **Pokemon Multiplier:** 1 + ${format(nuggiePokemonMultiplier, true)} * ${format(pokemonCount, true)} = ${format(1 + nuggiePokemonMultiplier * pokemonCount, true)}x
    **Nuggie Multiplier:** 1 + ${format(nuggieNuggieMultiplier, true)} * ${format(log2Nuggies, true)} = ${format(1 + nuggieNuggieMultiplier * log2Nuggies, true)}x
    **Next Claim:** ${nextClaim > 0 ? `${(nextClaim / 60 / 60).toFixed(0)}h ${(nextClaim / 60 % 60).toFixed(0)}m ${(nextClaim % 60).toFixed(0)}s` : 'Ready'}
            `)
      .setTimestamp();
  }

  createGamblingEmbed(user, username, avatarURL) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
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
**Current Streak:** ${user.blackjack_streak}
**Max Streak:** ${user.blackjack_max_streak}

### Roulette
**Times Played:** ${user.roulette_times_played}
**Times Won:** ${user.roulette_times_won}
**Percentage Won:** ${format(user.roulette_times_played > 0 ? (user.roulette_times_won / user.roulette_times_played * 100) : 0, true)}%
**Amount Gambled:** ${format(user.roulette_amount_gambled)}
**Amount Won:** ${format(user.roulette_amount_won)} 
**Net Winnings:** ${format(user.roulette_amount_won - user.roulette_amount_gambled)}
**Relative Amount Won:** ${format(user.roulette_relative_won, true)} bets
**Relative Net Winnings:** ${format(user.roulette_relative_won - user.roulette_times_played, true)} bets
**Current Streak:** ${user.roulette_streak}
**Max Streak:** ${user.roulette_max_streak}
            `)
      .setTimestamp();
  }

  createOthersEmbed(user, username, avatarURL) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
## Others
**Pity:** ${user.pity}
**Birthday:** ${user.birthdays ? user.birthdays : 'No birthday set'}
**Murders:** ${user.murder_success} Successes, ${user.murder_fail} Fails
**Last Murder:** ${user.last_murder ? new Date(user.last_murder).toLocaleString() : 'Never'}
            `)
      .setTimestamp();
  }

  createPokemonsEmbed(pokemonList, username, avatarURL) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`**Pokemons:** \`\`\`${pokemonList}\`\`\``)
      .setTimestamp();
  }
}

module.exports = Profile;
