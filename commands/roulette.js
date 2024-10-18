const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const marriageBenefits = require('../utils/marriageBenefits.js');

class Roulette extends Command {
    constructor(client) {
        super(client, "roulette", "guess what? more betting. bet your credits on roulette.", [
            {
                name: 'amount',
                description: 'the amount of mystic credits to bet',
                type: 4,
                required: true
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
                    { name: 'Even', value: 'even' },
                    { name: 'Odd', value: 'odd' }
                ]
            },
            {
                name: 'bet_value',
                description: 'the value if it is a number bet',
                type: 4,
                required: false
            }
        ]);
    }

    async run(interaction) {
        const amount = interaction.options.getInteger('amount');
        const betType = interaction.options.getString('bet_type');
        const betValue = interaction.options.getInteger('bet_value');
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

        if (betType === 'number' && (isNaN(betValue) || betValue < 0 || betValue > 36 || betValue == null)) {
            await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`Invalid number. Must be between 0 and 36`)
            ]});
            return;
        }

        // Spin the wheel
        const wheelResult = this.spinWheel();
        const colorResult = this.getColor(wheelResult);

        let winnings = 0;
        let resultMessage = `The wheel landed on **${wheelResult} ${colorResult}**.\n`;

        // Determine if the bet was successful
        if (betType === 'number' && parseInt(betValue) === wheelResult) {
            winnings = amount * 38;
            resultMessage += `You correctly guessed the number!`;
        } else if (betType === 'red' && colorResult === 'red') {
            winnings = amount * 2.1;
            resultMessage += `You correctly guessed red!`;
        } else if (betType === 'black' && colorResult === 'black') {
            winnings = amount * 2.1; 
            resultMessage += `You correctly guessed black!`;
        } else if (betType === 'even' && wheelResult !== 0 && wheelResult % 2 === 0) {
            winnings = amount * 2.1;
            resultMessage += `You correctly guessed even!`;
        } else if (betType === 'odd' && wheelResult % 2 !== 0) {
            winnings = amount * 2.1;
            resultMessage += `You correctly guessed odd!`;
        } else {
            resultMessage += `You guessed wrongly. Skill issue.`;
        }

        // Apply marriage benefits
        winnings = await marriageBenefits(this.client, interaction.user.id, winnings);
        await this.client.db.addUserAttr(interaction.user.id, 'roulette_times_played', 1);
        await this.client.db.addUserAttr(interaction.user.id, 'roulette_amount_gambled', amount);
        await this.client.db.addUserAttr(interaction.user.id, 'roulette_times_won', winnings > 0 ? 1 : 0);
        await this.client.db.addUserAttr(interaction.user.id, 'roulette_amount_won', winnings);
        await this.client.db.addUserAttr(interaction.user.id, 'roulette_relative_won', winnings / amount);
        await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings - amount);

        await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
            .setColor(winnings > 0 ? '#00AA00' : '#AA0000')
            .setTitle(`You bet ${format(amount)} mystic credits and ${winnings > 0 ? `won ${format(winnings)} mystic credits!` : 'lost!'}\n`)
            .setDescription(resultMessage)
        ]});
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
