import { EmbedBuilder, type ChatInputCommandInteraction, type ColorResolvable } from 'discord.js';

import { log } from './log';
import claimSkinConfig from '../data/config/skin/claim.json';
import {
  getNuggieFlatMultiplier,
  getNuggieStreakMultiplier,
  getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier,
  getNuggieNuggieMultiplier,
} from './ascensionupgrades';
import {
  getMultiplierAmount,
  getMultiplierChance,
  getBekiCooldown,
} from './upgrades';
import { format } from './math';
import { withUserLock, userLocks } from './userLock';

const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

const BEKI_COOLDOWN_RESPONSES: { title: string; gifUrl: string }[] = [
  { title: 'Beki is currently cooking the next batch of dinonuggies please wait', gifUrl: 'https://c.tenor.com/i6sOwD66MAEAAAAC/tenor.gif' },
  { title: 'Beki is having a little bit of an issue. Please hold', gifUrl: 'https://c.tenor.com/h6XlgMwYBnkAAAAd/tenor.gif' },
  { title: 'Ah shit i forgottt, hang on a momentt-', gifUrl: 'https://c.tenor.com/TYW-RNzp6hEAAAAC/tenor.gif' },
  { title: 'uhhh what is beki doing ?', gifUrl: 'https://media.tenor.com/RYGLfSXNIRIAAAAi/frieren.gif' },
  { title: 'Beki fucking dies of exhaustion', gifUrl: 'https://c.tenor.com/kU_EwdsrkLkAAAAC/tenor.gif' },
  { title: 'Beki Spins', gifUrl: 'https://media.tenor.com/WKPXrrxUvEgAAAAi/frieren-kuru-kuru.gif' },
  { title: 'Beki is trying out new hobbies', gifUrl: 'https://c.tenor.com/_33fqJ2mxQUAAAAd/tenor.gif' },
];

interface MultiplierAmount {
  gold: number;
  silver: number;
  bronze: number;
}

interface MultiplierChance {
  gold: number;
  silver: number;
  bronze: number;
}

interface RewardResult {
  amount: number;
  title: string;
  imageUrl: string;
  webImageUrl?: string;
  colour: string;
  footer: string;
  thumbnail: string;
}

async function getBaseAmount(client: any, uid: string, streak: number): Promise<number> {
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

async function formatReward(
  client: any,
  skinKey: string,
  amount: number,
  multiplier: MultiplierAmount,
  percentage: MultiplierChance,
): Promise<RewardResult> {
  const season = await client.db.globalConfig.getGlobalConfig('season') || 'normal';
  const json = claimSkinConfig as any;
  const resolvedSeason = json[season] ? season : 'normal';
  log(`season: ${season}`);
  log(`resolvedSeason: ${resolvedSeason}`);
  log(`skinKey: ${skinKey}`);
  log(`json[resolvedSeason]: ${JSON.stringify(json[resolvedSeason])}`);
  const skin = json[resolvedSeason][skinKey];
  const goldPercentage = format(percentage.gold * 100, true);
  const silverPercentage = format(percentage.silver * 100, true);
  const bronzePercentage = format(percentage.bronze * 100, true);
  const goldMultiplier = format(multiplier.gold, true);
  const silverMultiplier = format(multiplier.silver, true);
  const bronzeMultiplier = format(multiplier.bronze, true);

  // Determine appropriate multiplier based on skinKey, defaulting to 1.0 for "regular"
  const currentMultiplier = (multiplier as any)[skinKey] !== undefined ? (multiplier as any)[skinKey] : 1.0;

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
    webImageUrl: skin.webImageUrl,
    colour: skin.colour,
    footer: formattedFooter,
    thumbnail: skin.thumbnail,
  };
}

async function getAmount(client: any, uid: string, streak: number): Promise<RewardResult> {
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

type ClaimResult =
  | {
    status: 'cooldown';
    title: string;
    gifUrl: string;
    hoursRemaining: number;
    cooldown: number;
  }
  | {
    status: 'broken_streak';
    amount: number;
    previousDinonuggies: number;
    previousStreak: number;
  }
  | {
    status: 'success';
    amount: number;
    title: string;
    imageUrl: string;
    webImageUrl?: string;
    colour: string;
    footer: string;
    thumbnail: string;
    previousDinonuggies: number;
    previousStreak: number;
  };

async function processClaimInner(client: any, uid: string): Promise<ClaimResult> {
  const now = Date.now();
  const lastClaimedInt = await client.db.user.getUserAttr(uid, 'dinonuggiesLastClaimed');
  const lastClaimed = lastClaimedInt || null;
  const diff = lastClaimed ? now - lastClaimed : DAY_LENGTH;

  const streak = await client.db.user.getUserAttr(uid, 'dinonuggiesClaimStreak');
  const dinonuggies = await client.db.user.getUserAttr(uid, 'dinonuggies');
  const bekiLevel = await client.db.user.getUserAttr(uid, 'bekiLevel');
  const cooldown = getBekiCooldown(bekiLevel);

  if (diff < cooldown * HOUR_LENGTH) {
    const selected = BEKI_COOLDOWN_RESPONSES[Math.floor(Math.random() * BEKI_COOLDOWN_RESPONSES.length)];
    return {
      status: 'cooldown',
      title: selected.title,
      gifUrl: selected.gifUrl,
      hoursRemaining: cooldown - diff / HOUR_LENGTH,
      cooldown,
    };
  }

  if (diff > 2 * DAY_LENGTH) {
    const amount = Math.ceil(await getBaseAmount(client, uid, 0));
    await client.db.user.addUserAttr(uid, 'dinonuggies', amount);
    await client.db.user.setUserAttr(uid, 'dinonuggiesLastClaimed', now);
    await client.db.user.setUserAttr(uid, 'dinonuggiesClaimStreak', 1);
    return {
      status: 'broken_streak',
      amount,
      previousDinonuggies: dinonuggies,
      previousStreak: streak,
    };
  }

  const reward = await getAmount(client, uid, streak);
  await client.db.user.addUserAttr(uid, 'dinonuggies', reward.amount);
  await client.db.user.setUserAttr(uid, 'dinonuggiesLastClaimed', now);
  await client.db.user.addUserAttr(uid, 'dinonuggiesClaimStreak', 1);
  return {
    status: 'success',
    amount: reward.amount,
    title: reward.title,
    imageUrl: reward.imageUrl,
    webImageUrl: reward.webImageUrl,
    colour: reward.colour,
    footer: reward.footer,
    thumbnail: reward.thumbnail,
    previousDinonuggies: dinonuggies,
    previousStreak: streak,
  };
}

function processClaim(client: any, uid: string): Promise<ClaimResult> {
  return withUserLock(userLocks, uid, () => processClaimInner(client, uid));
}

// eslint-disable-next-line max-len
async function handleSuccessfulClaim(client: any, interaction: ChatInputCommandInteraction, newMessage = false): Promise<void> {
  const streak = await client.db.user.getUserAttr(interaction.user.id, 'dinonuggiesClaimStreak');
  const dinonuggies = await client.db.user.getUserAttr(interaction.user.id, 'dinonuggies');
  const now = Date.now();
  const {
    amount, title, imageUrl, colour, footer, thumbnail,
  } = await getAmount(client, interaction.user.id, streak);
  const embed = new EmbedBuilder()
    .setThumbnail(thumbnail)
    .setColor(colour as ColorResolvable)
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

export {
  getBaseAmount,
  getAmount,
  formatReward,
  handleSuccessfulClaim,
  processClaim,
  BEKI_COOLDOWN_RESPONSES,
  HOUR_LENGTH,
  DAY_LENGTH,
};
export type { ClaimResult };
