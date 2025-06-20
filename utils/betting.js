const Discord = require('discord.js');
const { antiFormat } = require('./math');

const INVALID_AMOUNT = -1;
const NEGATIVE_AMOUNT = -2;
const POOR_AMOUNT = -3;
const INFINITY_AMOUNT = -4;

const INFINITY_KEYWORDS = [
  'infinity', 'inf', '∞', 'unlimited', 'forever',
  'endless', 'neverending', 'boundless', 'limitless',
  'eternal', 'never-ending',
];

async function checkValidBetRaw(client, user, amountString) {
  if (INFINITY_KEYWORDS.some((keyword) => amountString.toLowerCase().includes(keyword.toLowerCase()))) {
    return INFINITY_AMOUNT;
  }
  const amount = antiFormat(amountString);
  if (Number.isNaN(amount)) {
    return INVALID_AMOUNT;
  }
  if (amount < 0) {
    return NEGATIVE_AMOUNT;
  }

  const credits = await client.db.user.getUserAttr(user.id, 'credits');
  if (amount > credits) {
    return POOR_AMOUNT;
  }
  return amount;
}

async function checkValidBet(interaction, amountString) {
  const result = await checkValidBetRaw(interaction.client, interaction.user, amountString);
  switch (result) {
    case INVALID_AMOUNT:
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid amount')
          .setDescription('idk if this parsing actually works'),
        ],
      });
      return null;
    case NEGATIVE_AMOUNT:
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You can\'t bet debt here'),
        ],
      });
      return null;
    case POOR_AMOUNT:
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You don\'t have enough credits smh'),
        ],
      });
      return null;
    case INFINITY_AMOUNT:
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You have been spotted cheating! Mystic credits set to 0.'),
        ],
      });
      setTimeout(async () => {
        await interaction.followUp({ content: '/j' });
      }, 10000);
      return null;
    default:
      return result;
  }
}

module.exports = { checkValidBet };
