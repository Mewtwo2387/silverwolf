const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { getMaxLevel } = require('../utils/upgrades');
const { format } = require('../utils/math');

class Ascend extends Command {
  constructor(client) {
    super(client, 'ascend', 'Ascend to reset stuff but get more stuff');
  }

  async run(interaction) {
    const ascensionLevel = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');
    const currentMaxLevel = getMaxLevel(ascensionLevel);

    const multiplierAmountLevel = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
    const multiplierRarityLevel = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
    const bekiLevel = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');
    const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

    const allMaxed = multiplierAmountLevel >= currentMaxLevel
                         && multiplierRarityLevel >= currentMaxLevel
                         && bekiLevel >= currentMaxLevel;

    if (dinonuggies < 500) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('Cannot ascend')
          .setDescription(`You need at least 500 dinonuggies to ascend. You have ${format(dinonuggies)} dinonuggies.`)
          .setFooter({ text: 'so no one ascends and complains they cant buy anything from it' })],
      });
      return;
    }

    const confirmEmbed = new Discord.EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('Ascension Confirmation')
      .setDescription(`Are you sure you want to ascend?
- Your dinonuggies (${format(dinonuggies)}) will be converted to ${format(dinonuggies)} heavenly nuggies which can be used to buy better upgrades
- All your upgrades, credits, bitcoins, dinonuggies, and streak will reset
- If you ascend with all upgrades maxed, you will gain an ascension level, which increases the level cap by 10

Your current upgrades:
• Multiplier amount: ${multiplierAmountLevel}/${currentMaxLevel}
• Multiplier rarity: ${multiplierRarityLevel}/${currentMaxLevel}
• Beki cooldown: ${bekiLevel}/${currentMaxLevel}

${allMaxed ? `Your ascension level will increase from ${ascensionLevel} to ${ascensionLevel + 1} if you ascend now, allowing you to buy upgrades up to level ${getMaxLevel(ascensionLevel + 1)}` : `Your ascension level will remain at ${ascensionLevel} as not all upgrades are maxed.`}`)
      .setFooter({ text: 'what even is this game now' });

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('confirm_ascend')
          .setLabel('Confirm')
          .setStyle(Discord.ButtonStyle.Success),
        new Discord.ButtonBuilder()
          .setCustomId('cancel_ascend')
          .setLabel('Cancel')
          .setStyle(Discord.ButtonStyle.Danger),
      );

    const confirmMessage = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    });

    const filter = (i) => ['confirm_ascend', 'cancel_ascend'].includes(i.customId) && i.user.id === interaction.user.id;
    const collector = confirmMessage.createMessageComponentCollector({ filter, time: 30000 });

    let clicked = false;
    collector.on('collect', async (i) => {
      clicked = true;
      await confirmMessage.edit({ components: [] });

      if (i.customId === 'confirm_ascend') {
        await this.client.db.setUserAttr(interaction.user.id, 'credits', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'bitcoin', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'last_bought_price', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'last_bought_amount', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'total_bought_price', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'total_bought_amount', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'total_sold_price', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'total_sold_amount', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', null);
        await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 0);
        await this.client.db.setUserAttr(interaction.user.id, 'multiplier_amount_level', 1);
        await this.client.db.setUserAttr(interaction.user.id, 'multiplier_rarity_level', 1);
        await this.client.db.setUserAttr(interaction.user.id, 'beki_level', 1);
        await this.client.db.addUserAttr(interaction.user.id, 'heavenly_nuggies', dinonuggies);
        if (allMaxed) {
          await this.client.db.setUserAttr(interaction.user.id, 'ascension_level', ascensionLevel + 1);
        }

        const resultEmbed = new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Ascension Successful!')
          .setDescription(`You have ascended!
- Gained ${format(dinonuggies)} heavenly nuggies
- All other stuff reset
${allMaxed ? `- Ascension level increased to ${ascensionLevel + 1}` : '- Ascension level remained the same'}
- New max level: ${getMaxLevel(allMaxed ? ascensionLevel + 1 : ascensionLevel)}`)
          .setFooter({ text: 'what even is this game now' });

        await interaction.followUp({ embeds: [resultEmbed] });
      } else {
        await interaction.followUp({ content: 'Ascension cancelled.', embeds: [] });
      }
    });

    collector.on('end', async () => {
      if (!clicked) {
        await interaction.followUp({ content: 'Ascension timed out', embeds: [] });
      }
    });
  }
}

module.exports = Ascend;
