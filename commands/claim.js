const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const {
  getNuggieStreakMultiplier, getNuggieFlatMultiplier, getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} = require('../utils/ascensionupgrades');
const { getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades');
const { format } = require('../utils/math');
const { Command } = require('./classes/command');
const { logError, log } = require('../utils/log');

const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

class Claim extends Command {
  constructor(client) {
    super(client, 'claim', 'Claim your daily dinonuggies', []);
  }

  async formatReward(skinKey, amount, multiplier, gold, silver, bronze) {
    const season = await this.client.db.getGlobalConfig('season') || 'normal';
    const skin = await JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config/skin/claim.json'), 'utf8'))[season][skinKey];
    const goldPercentage = format(gold * 100, true);
    const silverPercentage = format(silver * 100, true);
    const bronzePercentage = format(bronze * 100, true);
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
      .replace(/{multiplierGold}/g, goldMultiplier)
      .replace(/{multiplierSilver}/g, silverMultiplier)
      .replace(/{multiplierBronze}/g, bronzeMultiplier);

    return {
      amount,
      title: skin.title.replace('{amount}', format(amount)).replace('{multiplier}', format(currentMultiplier, true)),
      imageUrl: skin.imageUrl,
      colour: skin.colour,
      footer: formattedFooter,
      thumbnail: skin.thumbnail,
    };
  }

  async getBaseAmount(uid, streak) {
    const nuggieFlatMultiplierLevel = await this.client.db.getUserAttr(uid, 'nuggieFlatMultiplierLevel');
    const nuggieStreakMultiplierLevel = await this.client.db.getUserAttr(uid, 'nuggieStreakMultiplierLevel');
    const marriageBenefitsMultiplier = await this.client.db.marriage.getMarriageBenefits(uid);

    const nuggieCreditsMultiplierLevel = await this.client.db.getUserAttr(uid, 'nuggieCreditsMultiplierLevel');
    const credits = await this.client.db.getUserAttr(uid, 'credits');
    const log2Credits = credits > 1 ? Math.log2(credits) : 0;

    const nuggiePokemonMultiplierLevel = await this.client.db.getUserAttr(uid, 'nuggiePokemonMultiplierLevel');
    const pokemonCount = await this.client.db.getUniquePokemonCount(uid);

    const nuggieNuggieMultiplierLevel = await this.client.db.getUserAttr(uid, 'nuggieNuggieMultiplierLevel');
    const nuggies = await this.client.db.getUserAttr(uid, 'dinonuggies');
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

  async getAmount(uid, streak) {
    const rand = Math.random();
    const multiplierAmountLevel = await this.client.db.getUserAttr(uid, 'multiplierAmountLevel');
    const multiplierRarityLevel = await this.client.db.getUserAttr(uid, 'multiplierRarityLevel');
    const multiplier = getMultiplierAmount(multiplierAmountLevel);
    const { gold, silver, bronze } = getMultiplierChance(multiplierRarityLevel);
    log('claiming dinonuggies');

    if (rand < gold) {
      const amount = Math.ceil(await this.getBaseAmount(uid, streak) * multiplier.gold);
      return this.formatReward('gold', amount, multiplier, gold, silver, bronze);
    } if (rand < gold + silver) {
      const amount = Math.ceil(await this.getBaseAmount(uid, streak) * multiplier.silver);
      return this.formatReward('silver', amount, multiplier, gold, silver, bronze);
    } if (rand < gold + silver + bronze) {
      const amount = Math.ceil(await this.getBaseAmount(uid, streak) * multiplier.bronze);
      return this.formatReward('bronze', amount, multiplier, gold, silver, bronze);
    }
    const amount = Math.ceil(await this.getBaseAmount(uid, streak));
    return this.formatReward('regular', amount, multiplier, gold, silver, bronze);
  }

  async handleSuccessfulClaim(interaction, newMessage = false) {
    const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggiesClaimStreak');
    const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
    const now = new Date();
    const {
      amount, title, imageUrl, colour, footer, thumbnail,
    } = await this.getAmount(interaction.user.id, streak);
    const embed = new Discord.EmbedBuilder()
      .setThumbnail(thumbnail)
      .setColor(colour)
      .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
      .setTitle(title)
      .setDescription(`You now have ${format(dinonuggies + amount)} dinonuggies. You are on a streak of ${streak + 1} days.`)
      .setImage(imageUrl)
      .setFooter({ text: `dinonuggie | ${footer}`, iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' });

    await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', amount);
    await this.client.db.setUserAttr(interaction.user.id, 'dinonuggiesLastClaimed', now);
    await this.client.db.addUserAttr(interaction.user.id, 'dinonuggiesClaimStreak', 1);
    if (newMessage) {
      await interaction.followUp({ embeds: [embed] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  }

  async run(interaction) {
    try {
      const now = new Date();
      const lastClaimedInt = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggiesLastClaimed');

      const lastClaimed = lastClaimedInt ? new Date(lastClaimedInt) : null;
      const diff = lastClaimed ? now - lastClaimed : DAY_LENGTH;

      const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggiesClaimStreak');
      const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
      const bekiLevel = await this.client.db.getUserAttr(interaction.user.id, 'bekiLevel');

      const cooldown = getBekiCooldown(bekiLevel);

      if (diff < cooldown * HOUR_LENGTH) {
        const responses = [
          {
            title: 'Beki is currently cooking the next batch of dinonuggies please wait',
            gifUrl: 'https://media1.tenor.com/m/i6sOwD66MAEAAAAC/frieren-frieren-beyond-journey%27s-end.gif',
          },
          {
            title: 'Beki is having a little bit of an issue. Please hold',
            gifUrl: 'https://media1.tenor.com/m/h6XlgMwYBnkAAAAd/frieren-sousou-no-frieren.gif',
          },
          {
            title: 'Ah shit i forgottt, hang on a momentt-',
            gifUrl: 'https://media1.tenor.com/m/TYW-RNzp6hEAAAAC/sousou-no-frieren-frieren-beyond-journey.gif',
          },
          {
            title: 'uhhh what is beki doing ?',
            gifUrl: 'https://media.tenor.com/RYGLfSXNIRIAAAAi/frieren.gif',
          },
          {
            title: 'Beki fucking dies of exhaustion',
            gifUrl: 'https://media1.tenor.com/m/kU_EwdsrkLkAAAAC/frieren-dies-cold.gif',
          },
        ];

        const selectedResponse = responses[Math.floor(Math.random() * responses.length)];

        // Build and send the embed
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setTitle(selectedResponse.title)
              .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
              .setDescription(`You can claim your next nuggie in ${cooldown - diff / HOUR_LENGTH} hours.`)
              .setColor('#FF0000')
              .setImage(selectedResponse.gifUrl)
              .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
              .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' }),
          ],
        });
      } else if (diff > 2 * DAY_LENGTH) {
        const amount = await this.getBaseAmount(interaction.user.id, 0);
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
            .setTitle(`${format(amount)} dinonuggies claimed!`)
            .setDescription(`You now have ${format(dinonuggies + amount)} dinonuggies. You broke your streak of ${streak} days.`)
            .setColor('#83F28F')
            .setImage('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
            .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
            .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' }),
          ],
        });
        await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', amount);
        await this.client.db.setUserAttr(interaction.user.id, 'dinonuggiesLastClaimed', now);
        await this.client.db.setUserAttr(interaction.user.id, 'dinonuggiesClaimStreak', 1);
      } else {
        await this.handleSuccessfulClaim(interaction);
      }

      if (await this.client.db.getGlobalConfig('banned') === 'removed') {
        const embed = new Discord.EmbedBuilder()
          .setColor('Green')
          .setTitle('Welcome back!')
          .setDescription(`Thanks for your patience and support. As a result of Iruma's efforts, commands are back in ${interaction.guild.name}!
                        
Please continue to claim, gamble, and catch!`);
        await interaction.channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logError('Error claiming dinonuggies:', error);
      await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
    }
  }
}

module.exports = Claim;
