import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { checkValidBet } from '../utils/betting';

export interface Card { suit: string; value: string; }

export function createDeck(): Card[] {
  const suits = ['♠', '♣', '♥', '♦'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({ suit, value });
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function drawCard(deck: Card[]): Card {
  return deck.pop() as Card;
}

export function calculateHand(hand: Card[]): number {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.value === 'A') {
      aces += 1;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value, 10);
    }
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function formatHand(hand: Card[]): string {
  return hand.map((card) => `${card.suit}${card.value}`).join(', ');
}

export interface BlackjackWinResult { multi: number; streak: number; winnings: number; }

export async function recordBlackjackWin(client: any, userId: string, amount: number): Promise<BlackjackWinResult> {
  let streak = await client.db.user.getUserAttr(userId, 'blackjackStreak');
  await client.db.user.addUserAttr(userId, 'blackjackTimesPlayed', 1);
  await client.db.user.addUserAttr(userId, 'blackjackAmountGambled', amount);
  await client.db.user.addUserAttr(userId, 'blackjackTimesWon', 1);

  const multi = await client.db.marriage.getMarriageBenefits(userId) * 2.1 * 1.08 ** streak;
  streak += 1;
  if (streak > await client.db.user.getUserAttr(userId, 'blackjackMaxStreak')) {
    await client.db.user.setUserAttr(userId, 'blackjackMaxStreak', streak);
  }

  const winnings = amount * multi;
  await client.db.user.addUserAttr(userId, 'blackjackAmountWon', winnings);
  await client.db.user.addUserAttr(userId, 'blackjackRelativeWon', multi);
  await client.db.user.addUserAttr(userId, 'credits', winnings - amount);
  await client.db.user.setUserAttr(userId, 'blackjackStreak', streak);

  return { multi, streak, winnings };
}

export async function recordBlackjackLoss(client: any, userId: string, amount: number): Promise<void> {
  await client.db.user.addUserAttr(userId, 'blackjackTimesPlayed', 1);
  await client.db.user.addUserAttr(userId, 'blackjackAmountGambled', amount);
  await client.db.user.addUserAttr(userId, 'blackjackTimesLost', 1);
  await client.db.user.addUserAttr(userId, 'credits', -amount);
  await client.db.user.setUserAttr(userId, 'blackjackStreak', 0);
}

export async function recordBlackjackTie(client: any, userId: string, amount: number): Promise<void> {
  await client.db.user.addUserAttr(userId, 'blackjackTimesPlayed', 1);
  await client.db.user.addUserAttr(userId, 'blackjackAmountGambled', amount);
  await client.db.user.addUserAttr(userId, 'blackjackTimesDrawn', 1);
  await client.db.user.addUserAttr(userId, 'blackjackAmountWon', amount);
  await client.db.user.addUserAttr(userId, 'blackjackRelativeWon', 1);
}

class Blackjack extends Command {
  constructor(client: any) {
    super(client, 'blackjack', 'bj with silverwolf', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
    ], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    const deck = createDeck();
    const playerHand = [drawCard(deck), drawCard(deck)];
    const dealerHand = [drawCard(deck), drawCard(deck)];

    const gameMessage = await interaction.editReply({
      embeds: [this.buildEmbed(playerHand, dealerHand, 'Game Start')],
      components: [this.buildButtons()],
    });

    const collector = gameMessage.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i: any) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "These buttons aren't for you smh", flags: Discord.MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'hit') {
        playerHand.push(drawCard(deck));
        const playerTotal = calculateHand(playerHand);
        if (playerTotal > 21) {
          collector.stop('busted');
        } else {
          await i.update({ embeds: [this.buildEmbed(playerHand, dealerHand, 'Hit')], components: [this.buildButtons()] });
        }
      } else if (i.customId === 'stand') {
        collector.stop('stand');
      }
    });

    collector.on('end', async (_collected: any, reason: string) => {
      if (reason === 'time') {
        await interaction.editReply({ content: 'Time ran out! The game has ended.', components: [] });
        await this.handleLoss(interaction, amount, playerHand, dealerHand, 'You ran out of time! Silverwolf wins!');
        return;
      }

      let resultMessage;
      if (reason === 'busted') {
        await this.handleLoss(interaction, amount, playerHand, dealerHand, 'You busted!');
        return;
      }

      while (calculateHand(dealerHand) < 17) {
        dealerHand.push(drawCard(deck));
      }

      const playerTotal = calculateHand(playerHand);
      const dealerTotal = calculateHand(dealerHand);

      if (dealerTotal > 21 || playerTotal > dealerTotal) {
        resultMessage = 'You win!';
        await this.handleWin(interaction, amount, playerHand, dealerHand, resultMessage);
      } else if (playerTotal < dealerTotal) {
        resultMessage = 'Silverwolf wins!';
        await this.handleLoss(interaction, amount, playerHand, dealerHand, resultMessage);
      } else {
        resultMessage = 'No one wins!';
        await this.handleTie(interaction, amount, playerHand, dealerHand, resultMessage);
      }
    });
  }

  buildEmbed(playerHand: Card[], dealerHand: Card[], title: string) {
    return new Discord.EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Blackjack - ${title}`)
      .setDescription(`Your hand: ${formatHand(playerHand)} (${calculateHand(playerHand)})\nSilverwolf's hand: ${formatHand([dealerHand[0]])} (??)\n\nHit or Stand?`);
  }

  buildButtons() {
    return new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('hit')
          .setLabel('Hit')
          .setStyle(Discord.ButtonStyle.Primary),
        new Discord.ButtonBuilder()
          .setCustomId('stand')
          .setLabel('Stand')
          .setStyle(Discord.ButtonStyle.Secondary),
      );
  }

  async handleWin(interaction: any, amount: number, playerHand: Card[], dealerHand: Card[], message: string) {
    const { multi, streak } = await recordBlackjackWin(this.client, interaction.user.id, amount);

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`${message} You won ${format(amount * multi)} mystic credits!`)
        .setDescription(`Your hand: ${formatHand(playerHand)} (${calculateHand(playerHand)})
Silverwolf's hand: ${formatHand(dealerHand)} (${calculateHand(dealerHand)})
You are now on a streak of ${streak}`)],
      components: [],
    });
  }

  async handleLoss(interaction: any, amount: number, playerHand: Card[], dealerHand: Card[], message: string) {
    await recordBlackjackLoss(this.client, interaction.user.id, amount);

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#AA0000')
        .setTitle(`${message} You lost ${format(amount)} mystic credits!`)
        .setDescription(`Your hand: ${formatHand(playerHand)} (${calculateHand(playerHand)})
Silverwolf's hand: ${formatHand(dealerHand)} (${calculateHand(dealerHand)})`)],
      components: [],
    });
  }

  async handleTie(interaction: any, amount: number, playerHand: Card[], dealerHand: Card[], message: string) {
    await recordBlackjackTie(this.client, interaction.user.id, amount);
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle(`${message} Nothing happened to your ${format(amount)} mystic credits, boring.`)
        .setDescription(`Your hand: ${formatHand(playerHand)} (${calculateHand(playerHand)})
Silverwolf's hand: ${formatHand(dealerHand)} (${calculateHand(dealerHand)})`)],
      components: [],
    });
  }
}

export default Blackjack;
