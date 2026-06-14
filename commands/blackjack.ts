import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { checkValidBet } from '../utils/betting';
import {
  type Card,
  createDeck,
  drawCard,
  calculateHand,
  formatHand,
  resolveBlackjackStand,
  recordBlackjackWin,
  recordBlackjackLoss,
  recordBlackjackTie,
} from '../utils/blackjack';

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

      if (reason === 'busted') {
        await this.handleLoss(interaction, amount, playerHand, dealerHand, 'You busted!');
        return;
      }

      const { outcome } = resolveBlackjackStand(deck, playerHand, dealerHand);
      if (outcome === 'win') {
        await this.handleWin(interaction, amount, playerHand, dealerHand, 'You win!');
      } else if (outcome === 'loss') {
        await this.handleLoss(interaction, amount, playerHand, dealerHand, 'Silverwolf wins!');
      } else {
        await this.handleTie(interaction, amount, playerHand, dealerHand, 'No one wins!');
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
