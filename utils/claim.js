const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const { log } = require('./log');
const {
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
} = require('./ascensionupgrades');
const {
  getMultiplierAmount,
  getMultiplierChance,
} = require('./upgrades');
const { format } = require('./math');

async function getBaseAmount(client, uid, streak) {
  const nuggieFlatMultiplierLevel = await client.db.user.getUserAttr(uid, 'nuggieFlatMultiplierLevel');
  const nuggieStreakMultiplierLevel = await client.db.user.getUserAttr(uid, 'nuggieStreakMultiplierLevel');
  const marriageBenefitsMultiplier = await client.db.marriage.getMarriageBenefits(uid);

  const nuggieCreditsMultiplierLevel = await client.db.user.getUserAttr(uid, 'nuggieCreditsMultiplierLevel');
  const credits = await client.db.user.getUserAttr(uid, 'credits');
  const log2Credits = credits > 1 ? Math.log2(credits) : 0;

  const nuggiePokemonMultiplierLevel = await client.db.user.getUserAttr(uid, 'nuggiePokemonMultiplierLevel');
  const pokemonCount = await client.db.pokemon.getUniquePokemonCount(uid);

  const nuggieNuggieMultiplierLevel = await client.db.user.getUserAttr(uid, 'nuggieNuggieMultiplierLevel');
  const nuggies = await client.db.user.getUserAttr(uid, 'dinonuggies');
  const log2Nuggies = nuggies > 1 ? Math.log2(nuggies) : 0;

  let baseAmount = (5 + streak);
  log(`Base amount: ${baseAmount}`);
  baseAmount *= getNuggieFlatMultiplier(nuggieFlatMultiplierLevel);
  log(`Base amount after flat multiplier: ${baseAmount}`);
  baseAmount *= (1 + streak * getNuggieStreakMultiplier(nuggieStreakMultiplierLevel));
  log(`Base amount after streak multiplier: ${baseAmount}`);
  baseAmount *= (1 + log2Credits * getNuggieCreditsMultiplier(nuggieCreditsMultiplierLevel));
  log(`Base amount after credits multiplier: ${baseAmount}`);
  baseAmount *= (1 + pokemonCount * getNuggiePokeMultiplier(nuggiePokemonMultiplierLevel));
  log(`Base amount after pokemon multiplier: ${baseAmount}`);
  baseAmount *= (1 + log2Nuggies * getNuggieNuggieMultiplier(nuggieNuggieMultiplierLevel));
  log(`Base amount after nuggie multiplier: ${baseAmount}`);
  baseAmount *= marriageBenefitsMultiplier;
  log(`Base amount after marriage benefits: ${baseAmount}`);
  return baseAmount;
}

async function formatReward(client, skinKey, amount, multiplier, percentage) {
  const season = await client.db.globalConfig.getGlobalConfig('season') || 'normal';
  const skin = await JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config/skin/claim.json'), 'utf8'))[season][skinKey];
  const goldPercentage = format(percentage.gold * 100, true);
  const silverPercentage = format(percentage.silver * 100, true);
  const bronzePercentage = format(percentage.bronze * 100, true);
  const goldMultiplier = format(multiplier.gold, true);
  const silverMultiplier = format(multiplier.silver, true);
  const bronzeMultiplier = format(multiplier.bronze, true);

  // Determine appropriate multiplier based on skinKey, defaulting to 1.0 for "regular"
  const currentMultiplier = multiplier[skinKey] !== undefined ? multiplier[skinKey] : 1.0;

  // Format footer with unique multipliers for each rarity
  const formattedFooter = skin.footer
    .replace(/{gold}/g, goldPercentage)
    .replace(/{silver}/g, silverPercentage)
    .replace(/{bronze}/g, bronzePercentage)
    .replace(/{goldMultiplier}/g, goldMultiplier)
    .replace(/{silverMultiplier}/g, silverMultiplier)
    .replace(/{bronzeMultiplier}/g, bronzeMultiplier);

  return {
    amount,
    title: skin.title.replace('{amount}', format(amount)).replace('{multiplier}', format(currentMultiplier, true)),
    imageUrl: skin.imageUrl,
    colour: skin.colour,
    footer: formattedFooter,
    thumbnail: skin.thumbnail,
  };
}

async function getAmount(client, uid, streak) {
  const rand = Math.random();
  const multiplierAmountLevel = await client.db.user.getUserAttr(uid, 'multiplierAmountLevel');
  const multiplierRarityLevel = await client.db.user.getUserAttr(uid, 'multiplierRarityLevel');
  const multiplier = getMultiplierAmount(multiplierAmountLevel);
  const percentage = getMultiplierChance(multiplierRarityLevel);
  log('claiming dinonuggies');

  if (rand < percentage.gold) {
    const amount = Math.ceil(await getBaseAmount(client, uid, streak) * multiplier.gold);
    return formatReward(client, 'gold', amount, multiplier, percentage);
  }
  if (rand < percentage.gold + percentage.silver) {
    const amount = Math.ceil(await getBaseAmount(client, uid, streak) * multiplier.silver);
    return formatReward(client, 'silver', amount, multiplier, percentage);
  }
  if (rand < percentage.gold + percentage.silver + percentage.bronze) {
    const amount = Math.ceil(await getBaseAmount(client, uid, streak) * multiplier.bronze);
    return formatReward(client, 'bronze', amount, multiplier, percentage);
  }
  const amount = Math.ceil(await getBaseAmount(client, uid, streak));
  return formatReward(client, 'regular', amount, multiplier, percentage);
}

async function handleSuccessfulClaim(client, interaction, newMessage = false) {
  const streak = await client.db.user.getUserAttr(interaction.user.id, 'dinonuggiesClaimStreak');
  const dinonuggies = await client.db.user.getUserAttr(interaction.user.id, 'dinonuggies');
  const now = new Date();
  const {
    amount, title, imageUrl, colour, footer, thumbnail,
  } = await getAmount(client, interaction.user.id, streak);
  const embed = new EmbedBuilder()
    .setThumbnail(thumbnail)
    .setColor(colour)
    .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
    .setTitle(title)
    .setDescription(`You now have ${format(dinonuggies + amount)} dinonuggies. You are on a streak of ${streak + 1} days.`)
    .setImage(imageUrl)
    .setFooter({ text: `dinonuggie | ${footer}`, iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' });

  await client.db.user.addUserAttr(interaction.user.id, 'dinonuggies', amount);
  await client.db.user.setUserAttr(interaction.user.id, 'dinonuggiesLastClaimed', now);
  await client.db.user.addUserAttr(interaction.user.id, 'dinonuggiesClaimStreak', 1);
  if (newMessage) {
    await interaction.followUp({ embeds: [embed] });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = {
  getBaseAmount,
  getAmount,
  formatReward,
  handleSuccessfulClaim,
};
