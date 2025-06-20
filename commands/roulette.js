const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const { checkValidBet } = require('../utils/betting');

class Roulette extends Command {
  constructor(client) {
    super(client, 'roulette', 'guess what? more betting. bet your credits on roulette.', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
      {
        name: 'bet_type',
        description: 'the type of bet (number, color, even, odd)',
        type: 3,
        required: true,
        choices: [
          { name: 'Number', value: 'number' },
          { name: 'Red', value: 'red' },
          { name: 'Black', value: 'black' },
          { name: 'Green', value: 'green' },
          { name: 'Even', value: 'even' },
          { name: 'Odd', value: 'odd' },
        ],
      },
      {
        name: 'bet_value',
        description: 'the value if it is a number bet',
        type: 4,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    // Proceed with normal roulette logic for numerical input
    const betType = interaction.options.getString('bet_type');
    const betValue = interaction.options.getInteger('bet_value');
    let streak = await this.client.db.user.getUserAttr(interaction.user.id, 'roulette_streak');
    const maxStreak = await this.client.db.user.getUserAttr(interaction.user.id, 'rouletteMaxStreak');

    if (betType === 'number' && (Number.isNaN(betValue) || betValue < 0 || betValue > 36 || betValue === null)) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid number. Must be between 0 and 36'),
        ],
      });
      return;
    }

    // Spin the wheel and continue normal logic
    const wheelResult = this.spinWheel();
    const colorResult = this.getColor(wheelResult);

    let multi = 0;
    let resultMessage = `The wheel landed on **${wheelResult} ${colorResult}**.\n`;

    // Determine if the bet was successful
    if (betType === 'number' && parseInt(betValue, 10) === wheelResult) {
      multi = 38 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed the number! You are now on a streak of ${streak}`;
    } else if (betType === 'red' && colorResult === 'red') {
      multi = 2 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed red! You are now on a streak of ${streak}`;
    } else if (betType === 'black' && colorResult === 'black') {
      multi = 2 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed black! You are now on a streak of ${streak}`;
    } else if (betType === 'green' && colorResult === 'green') {
      multi = 38 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed green! You are now on a streak of ${streak}`;
    } else if (betType === 'even' && wheelResult % 2 === 0) {
      multi = 2 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed even! You are now on a streak of ${streak}`;
    } else if (betType === 'odd' && wheelResult % 2 !== 0) {
      multi = 2 * 1.06 ** streak;
      streak += 1;
      resultMessage += `You correctly guessed odd! You are now on a streak of ${streak}`;
    } else {
      streak = 0;
      resultMessage += 'You guessed wrongly. Skill issue.';
    }

    // Apply marriage benefits
    multi *= await this.client.db.marriage.getMarriageBenefits(interaction.user.id);
    const winnings = multi * amount;
    await this.client.db.user.addUserAttr(interaction.user.id, 'rouletteTimesPlayed', 1);
    await this.client.db.user.addUserAttr(interaction.user.id, 'rouletteAmountGambled', amount);
    await this.client.db.user.addUserAttr(interaction.user.id, 'rouletteTimesWon', multi > 0 ? 1 : 0);
    await this.client.db.user.addUserAttr(interaction.user.id, 'rouletteAmountWon', winnings);
    await this.client.db.user.addUserAttr(interaction.user.id, 'rouletteRelativeWon', multi);
    await this.client.db.user.addUserAttr(interaction.user.id, 'credits', winnings - amount);
    await this.client.db.user.setUserAttr(interaction.user.id, 'rouletteStreak', streak);
    if (streak > maxStreak) {
      await this.client.db.user.setUserAttr(interaction.user.id, 'rouletteMaxStreak', streak);
    }

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor(multi > 0 ? '#00AA00' : '#AA0000')
        .setTitle(`You bet ${format(amount)} mystic credits and ${multi > 0 ? `won ${format(winnings)} mystic credits!` : 'lost!'}\n`)
        .setDescription(resultMessage),
      ],
    });
  }

  spinWheel() {
    // 0-36, with 0 being green
    return Math.floor(Math.random() * 37);
  }

  getColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
  }
}

module.exports = Roulette;
