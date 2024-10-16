const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const marriageBenefits = require('../utils/marriageBenefits.js');

class Blackjack extends Command {
    constructor(client) {
        super(client, "blackjack", "bj with silverwolf", [
            {
                name: 'amount',
                description: 'the amount of mystic credits to bet',
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction) {
        const amount = interaction.options.getInteger('amount');
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');

        if (amount < 0) {
            await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`You can't bet debt here too`)
            ]});
            return;
        }

        if (amount > credits) {
            await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`You don't have enough mystic credits to bet that much!`)
            ]});
            return;
        }

        const deck = this.createDeck();
        const playerHand = [this.drawCard(deck), this.drawCard(deck)];
        const dealerHand = [this.drawCard(deck), this.drawCard(deck)];

        let playerStand = false;

        const gameMessage = await interaction.editReply({
            embeds: [this.buildEmbed(playerHand, dealerHand, "Game Start")],
            components: [this.buildButtons()]
        });

        const collector = gameMessage.createMessageComponentCollector({ time: 60000 });
        
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: "These buttons aren't for you smh", ephemeral: true });
                return;
            }

            if (i.customId === 'hit') {
                playerHand.push(this.drawCard(deck));
                const playerTotal = this.calculateHand(playerHand);
                if (playerTotal > 21) {
                    collector.stop('busted');
                } else {
                    await i.update({ embeds: [this.buildEmbed(playerHand, dealerHand, "Hit")], components: [this.buildButtons()] });
                }
            } else if (i.customId === 'stand') {
                playerStand = true;
                collector.stop('stand');
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({ content: "Time ran out! The game has ended.", components: [] });
                return;
            }

            let resultMessage;
            if (reason === 'busted') {
                await this.handleLoss(interaction, amount, playerHand, dealerHand, "You busted!");
                return;
            }

            while (this.calculateHand(dealerHand) < 17) {
                dealerHand.push(this.drawCard(deck));
            }

            const playerTotal = this.calculateHand(playerHand);
            const dealerTotal = this.calculateHand(dealerHand);

            if (dealerTotal > 21 || playerTotal > dealerTotal) {
                resultMessage = "You win!";
                await this.handleWin(interaction, amount, playerHand, dealerHand, resultMessage);
            } else if (playerTotal < dealerTotal) {
                resultMessage = "Silverwolf wins!";
                await this.handleLoss(interaction, amount, playerHand, dealerHand, resultMessage);
            } else {
                resultMessage = "No one wins!";
                await this.handleTie(interaction, amount, playerHand, dealerHand, resultMessage);
            }
        });
    }

    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];
        
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value });
            }
        }

        // Shuffle the deck
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        return deck;
    }

    drawCard(deck) {
        return deck.pop();
    }

    calculateHand(hand) {
        let total = 0;
        let aces = 0;

        for (const card of hand) {
            if (card.value === 'A') {
                aces += 1;
                total += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                total += 10;
            } else {
                total += parseInt(card.value);
            }
        }

        while (total > 21 && aces > 0) {
            total -= 10;
            aces -= 1;
        }

        return total;
    }

    buildEmbed(playerHand, dealerHand, title) {
        return new Discord.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Blackjack - ${title}`)
            .setDescription(`Your hand: ${this.formatHand(playerHand)} (${this.calculateHand(playerHand)})\nSilverwolf's hand: ${this.formatHand([dealerHand[0]])} (??)\n\nHit or Stand?`);
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
                    .setStyle(Discord.ButtonStyle.Secondary)
            );
    }

    formatHand(hand) {
        return hand.map(card => `${card.suit}${card.value}`).join(', ');
    }

    async handleWin(interaction, amount, playerHand, dealerHand, message) {
        amount = await marriageBenefits(this.client, interaction.user.id, amount);
        await this.client.db.addUserAttr(interaction.user.id, 'credits', amount);
        await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`${message} You won ${format(amount)} mystic credits!`)
            .setDescription(`Your hand: ${this.formatHand(playerHand)} (${this.calculateHand(playerHand)})\nSilverwolf's hand: ${this.formatHand(dealerHand)} (${this.calculateHand(dealerHand)})`)], 
            components: [] 
        });
    }

    async handleLoss(interaction, amount, playerHand, dealerHand, message) {
        await this.client.db.addUserAttr(interaction.user.id, 'credits', -amount);
        await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle(`${message} You lost ${format(amount)} mystic credits!`)
            .setDescription(`Your hand: ${this.formatHand(playerHand)} (${this.calculateHand(playerHand)})\nSilverwolf's hand: ${this.formatHand(dealerHand)} (${this.calculateHand(dealerHand)})`)],
            components: []
        });
    }

    async handleTie(interaction, amount, playerHand, dealerHand, message) {
        await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
            .setColor('#FFFF00')
            .setTitle(`${message} Nothing happened to your ${format(amount)} mystic credits, boring.`)
            .setDescription(`Your hand: ${this.formatHand(playerHand)} (${this.calculateHand(playerHand)})\nSilverwolf's hand: ${this.formatHand(dealerHand)} (${this.calculateHand(dealerHand)})`)],
            components: []
        });
    }
}

module.exports = Blackjack;
