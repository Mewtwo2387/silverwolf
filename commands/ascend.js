const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { getMaxLevel } = require('../utils/upgrades');
const { format } = require('../utils/math');

class Ascend extends Command {
  constructor(client) {
    super(client, 'ascend', 'Ascend to reset stuff but get more stuff', [], { blame: 'ei' });
  }

  async run(interaction) {
    const user = await this.client.db.user.getUser(interaction.user.id);
    const currentMaxLevel = getMaxLevel(user.ascensionLevel);

    const allMaxed = user.multiplierAmountLevel >= currentMaxLevel
                         && user.multiplierRarityLevel >= currentMaxLevel
                         && user.bekiLevel >= currentMaxLevel;

    if (user.dinonuggies < 500) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('Cannot ascend')
          .setDescription(`You need at least 500 dinonuggies to ascend. You have ${format(user.dinonuggies)} dinonuggies.`)
          .setFooter({ text: 'so no one ascends and complains they cant buy anything from it' })],
      });
      return;
    }

    const confirmEmbed = new Discord.EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('Ascension Confirmation')
      .setDescription(`Are you sure you want to ascend?
- Your dinonuggies (${format(user.dinonuggies)}) will be converted to ${format(user.dinonuggies)} heavenly nuggies which can be used to buy better upgrades
- All your upgrades, credits, bitcoins, dinonuggies, and streak will reset
- If you ascend with all upgrades maxed, you will gain an ascension level, which increases the level cap by 10

Your current upgrades:
• Multiplier amount: ${user.multiplierAmountLevel}/${currentMaxLevel}
• Multiplier rarity: ${user.multiplierRarityLevel}/${currentMaxLevel}
• Beki cooldown: ${user.bekiLevel}/${currentMaxLevel}

${allMaxed ? `Your ascension level will increase from ${user.ascensionLevel} to ${user.ascensionLevel + 1} if you ascend now, allowing you to buy upgrades up to level ${getMaxLevel(user.ascensionLevel + 1)}` : `Your ascension level will remain at ${user.ascensionLevel} as not all upgrades are maxed.`}`)
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
        await this.client.db.user.ascendUser(interaction.user.id, allMaxed);

        const resultEmbed = new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Ascension Successful!')
          .setDescription(`You have ascended!
- Gained ${format(user.dinonuggies)} heavenly nuggies
- All other stuff reset
${allMaxed ? `- Ascension level increased to ${user.ascensionLevel + 1}` : '- Ascension level remained the same'}
- New max level: ${getMaxLevel(allMaxed ? user.ascensionLevel + 1 : user.ascensionLevel)}`)
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
