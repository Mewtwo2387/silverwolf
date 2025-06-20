const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const {
  getMaxLevel, getBekiCooldown,
} = require('../utils/upgrades');
const {
  getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} = require('../utils/ascensionupgrades');
const {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} = require('../utils/upgradesInfo');
const {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
} = require('../utils/ascensionupgradesInfo');

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
      user = await this.client.db.user.getUser(interaction.options.getMember('user').id);
      const discordUser = await this.client.users.fetch(user.id);
      username = discordUser.username;
      avatarURL = discordUser.displayAvatarURL({ dynamic: true, size: 512 });
      pokemons = await this.client.db.pokemon.getPokemons(interaction.options.getMember('user').id);
    } else {
      // Get the interaction user's data
      user = await this.client.db.user.getUser(interaction.user.id);
      username = interaction.user.username;
      avatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 512 });
      pokemons = await this.client.db.pokemon.getPokemons(interaction.user.id);
    }

    // Calculations
    const bekiCooldown = getBekiCooldown(user.bekiLevel) * 60 * 60;
    const nuggieFlatMultiplier = getNuggieFlatMultiplier(user.nuggieFlatMultiplierLevel);
    const nuggieStreakMultiplier = getNuggieStreakMultiplier(user.nuggieStreakMultiplierLevel);
    const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(user.nuggieCreditsMultiplierLevel);
    const nuggiePokemonMultiplier = getNuggiePokeMultiplier(user.nuggiePokemonMultiplierLevel);
    const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(user.nuggieNuggieMultiplierLevel);
    const { credits } = user;
    const log2Credits = credits > 1 ? Math.log2(credits) : 0;
    const pokemonCount = await this.client.db.pokemon.getUniquePokemonCount(interaction.options.getMember('user') ? interaction.options.getMember('user').id : interaction.user.id);
    const log2Nuggies = user.dinonuggies > 1 ? Math.log2(user.dinonuggies) : 0;
    const nextClaim = bekiCooldown - (Date.now() - user.dinonuggiesLastClaimed) / 1000;
    pokemons.sort((a, b) => a.pokemonName.localeCompare(b.pokemonName));
    const maxNameLength = Math.max(...pokemons.map((pokemon) => pokemon.pokemonName.length));
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
          detailsEmbed = this.createCurrencyEmbed(
            credits,
            user,
            username,
            avatarURL,
          );
          break;
        case 'levels':
          detailsEmbed = this.createLevelsEmbed(
            user,
            ascensionLevel,
            maxLevel,
            username,
            avatarURL,
          );
          break;
        case 'claims':
          detailsEmbed = await this.createClaimsEmbed(
            user,
            nextClaim,
            nuggieStreakMultiplier,
            nuggieFlatMultiplier,
            nuggieCreditsMultiplier,
            log2Credits,
            username,
            avatarURL,
            pokemonCount,
            log2Nuggies,
            nuggiePokemonMultiplier,
            nuggieNuggieMultiplier,
          );
          break;
        case 'gambling':
          detailsEmbed = this.createGamblingEmbed(
            user,
            username,
            avatarURL,
          );
          break;
        case 'others':
          detailsEmbed = this.createOthersEmbed(
            user,
            username,
            avatarURL,
          );
          break;
        case 'pokemons':
          detailsEmbed = this.createPokemonsEmbed(
            pokemonList,
            username,
            avatarURL,
          );
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
**Heavenly Nuggies:** ${format(user.heavenlyNuggies)}
            `)
      .setTimestamp();
  }

  createLevelsEmbed(
    user,
    ascensionLevel,
    maxLevel,
    username,
    avatarURL,
  ) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
## Levels
**Ascension Level:** Level ${ascensionLevel}
**Max Upgrade Level:** ${maxLevel}

${getMultiplierAmountInfo(user.multiplierAmountLevel, INFO_LEVEL.THIS_LEVEL)}

${getMultiplierChanceInfo(user.multiplierRarityLevel, INFO_LEVEL.THIS_LEVEL)}

${getBekiCooldownInfo(user.bekiLevel, INFO_LEVEL.THIS_LEVEL)}

${getNuggieFlatMultiplierInfo(user.nuggieFlatMultiplierLevel, INFO_LEVEL.THIS_LEVEL)}

${getNuggieStreakMultiplierInfo(user.nuggieStreakMultiplierLevel, INFO_LEVEL.THIS_LEVEL)}

${getNuggieCreditsMultiplierInfo(user.nuggieCreditsMultiplierLevel, INFO_LEVEL.THIS_LEVEL)}

${getNuggiePokeMultiplierInfo(user.nuggiePokemonMultiplierLevel, INFO_LEVEL.THIS_LEVEL)}

${getNuggieNuggieMultiplierInfo(user.nuggieNuggieMultiplierLevel, INFO_LEVEL.THIS_LEVEL)}
            `)
      .setTimestamp();
  }

  async createClaimsEmbed(
    user,
    nextClaim,
    nuggieStreakMultiplier,
    nuggieFlatMultiplier,
    nuggieCreditsMultiplier,
    log2Credits,
    username,
    avatarURL,
    pokemonCount,
    log2Nuggies,
    nuggiePokemonMultiplier,
    nuggieNuggieMultiplier,
  ) {
    return new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`${username}'s Profile`)
      .setThumbnail(avatarURL)
      .setDescription(`
    ## Claims
    **Current Streak:** ${user.dinonuggiesClaimStreak} days
    **Base Claim Amount:** 5 + ${format(user.dinonuggiesClaimStreak)} = ${format(5 + user.dinonuggiesClaimStreak)}
    **Streak Multiplier:** 1 + ${format(nuggieStreakMultiplier, true)} * ${format(user.dinonuggiesClaimStreak)} = ${format(1 + nuggieStreakMultiplier * user.dinonuggiesClaimStreak, true)}x
    **Flat Multiplier:** ${format(nuggieFlatMultiplier, true)}x
    **Marriage Multiplier:** ${format(await this.client.db.marriage.getMarriageBenefits(user.id), true)}x
    **Credits Multiplier:** 1 + ${format(nuggieCreditsMultiplier, true)} * ${format(log2Credits, true)} = ${format(1 + nuggieCreditsMultiplier * log2Credits, true)}x
    **Pokemon Multiplier:** 1 + ${format(nuggiePokemonMultiplier, true)} * ${format(pokemonCount, true)} = ${format(1 + nuggiePokemonMultiplier * pokemonCount, true)}x
    **Nuggie Multiplier:** 1 + ${format(nuggieNuggieMultiplier, true)} * ${format(log2Nuggies, true)} = ${format(1 + nuggieNuggieMultiplier * log2Nuggies, true)}x
    **Next Claim:** ${nextClaim > 0 ? `${(nextClaim / 60 / 60).toFixed(0)}h ${((nextClaim / 60) % 60).toFixed(0)}m ${(nextClaim % 60).toFixed(0)}s` : 'Ready'}
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
**Times Played:** ${user.slotsTimesPlayed}
**Times Won:** ${user.slotsTimesWon}
**Percentage Won:** ${format(user.slotsTimesPlayed > 0 ? ((user.slotsTimesWon / user.slotsTimesPlayed) * 100) : 0, true)}%
**Amount Gambled:** ${format(user.slotsAmountGambled)}
**Amount Won:** ${format(user.slotsAmountWon)} 
**Net Winnings:** ${format(user.slotsAmountWon - user.slotsAmountGambled)}
**Relative Amount Won:** ${format(user.slotsRelativeWon, true)} bets
**Relative Net Winnings:** ${format(user.slotsRelativeWon - user.slotsTimesPlayed, true)} bets

### Blackjack
**Times Played:** ${user.blackjackTimesPlayed}
**Times Won:** ${user.blackjackTimesWon}
**Times Drew:** ${user.blackjackTimesDrawn}
**Times Lost:** ${user.blackjackTimesLost}
**Percentage Won (Excluding Draws):** ${format((user.blackjackTimesWon + user.blackjackTimesLost) > 0 ? ((user.blackjackTimesWon / (user.blackjackTimesWon + user.blackjackTimesLost)) * 100) : 0, true)}%
**Amount Gambled:** ${format(user.blackjackAmountGambled)}
**Amount Won:** ${format(user.blackjackAmountWon)} 
**Net Winnings:** ${format(user.blackjackAmountWon - user.blackjackAmountGambled)}
**Relative Amount Won:** ${format(user.blackjackRelativeWon, true)} bets
**Relative Net Winnings:** ${format(user.blackjackRelativeWon - user.blackjackTimesPlayed, true)} bets
**Current Streak:** ${user.blackjackStreak}
**Max Streak:** ${user.blackjackMaxStreak}

### Roulette
**Times Played:** ${user.rouletteTimesPlayed}
**Times Won:** ${user.rouletteTimesWon}
**Percentage Won:** ${format(user.rouletteTimesPlayed > 0 ? ((user.rouletteTimesWon / user.rouletteTimesPlayed) * 100) : 0, true)}%
**Amount Gambled:** ${format(user.rouletteAmountGambled)}
**Amount Won:** ${format(user.rouletteAmountWon)} 
**Net Winnings:** ${format(user.rouletteAmountWon - user.rouletteAmountGambled)}
**Relative Amount Won:** ${format(user.rouletteRelativeWon, true)} bets
**Relative Net Winnings:** ${format(user.rouletteRelativeWon - user.rouletteTimesPlayed, true)} bets
**Current Streak:** ${user.rouletteStreak}
**Max Streak:** ${user.rouletteMaxStreak}
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
**Murders:** ${user.murderSuccess} Successes, ${user.murderFail} Fails
**Last Murder:** ${user.lastMurder ? new Date(user.lastMurder).toLocaleString() : 'Never'}
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
