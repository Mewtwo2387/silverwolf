const Discord = require('discord.js');

const { format } = require('../utils/math');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');
const { getBaseAmount, handleSuccessfulClaim } = require('../utils/claim');
const { getBekiCooldown } = require('../utils/upgrades');

const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

class Claim extends Command {
  constructor(client) {
    super(client, 'claim', 'Claim your daily dinonuggies', []);
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
        const amount = await getBaseAmount(this.client, interaction.user.id, 0);
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
        await this.client.db.user.addUserAttr(interaction.user.id, 'dinonuggies', amount);
        await this.client.db.user.setUserAttr(interaction.user.id, 'dinonuggiesLastClaimed', now);
        await this.client.db.user.setUserAttr(interaction.user.id, 'dinonuggiesClaimStreak', 1);
      } else {
        await handleSuccessfulClaim(this.client, interaction);
      }

      if (await this.client.db.globalConfig.getGlobalConfig('banned') === 'removed') {
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
