const { Command } = require('./classes/command.js');
const { Bitcoin } = require('../classes/bitcoin.js');
const Discord = require('discord.js');

class BuyBitcoin extends Command {
    constructor(client){
        super(client, "buybitcoin", "buy bitcoin with mystic credits", [
            {
                name: 'amount',
                description: 'the amount of bitcoin to buy (negative to sell)',
                type: 10,
                required: true
            }
        ]);
    }

    async run(interaction){
        const bitcoin = new Bitcoin();
        const amount = interaction.options.getNumber('amount');
        const price = await bitcoin.getPrice();
        const credits = await this.client.db.getCredits(interaction.user.id);
        const bitcoinAmount = await this.client.db.getBitcoin(interaction.user.id);


        if(price == null){
            await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`Failed to get bitcoin price`)
            ]});
            return;
        }

        if (amount == 0) {
            await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`You bought gamebang's pp!`)
            ]});
            return;
        }else if (amount < 0) {
            if (bitcoinAmount < -amount) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You don't have that much bitcoin to sell smh`)
                ]});
                return;
            } else {
                await this.client.db.addBitcoin(interaction.user.id, amount);
                await this.client.db.addCredits(interaction.user.id, -amount * price);
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Sold ${-amount} bitcoin for ${-amount * price} mystic credits!`)
                ]});
                return;
            }
        } else {
            if (credits < amount * price) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You're too poor to buy that much bitcoin smh`)
                ]});
                return;
            } else {
                await this.client.db.addBitcoin(interaction.user.id, amount);
                await this.client.db.addCredits(interaction.user.id, -amount * price);
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Bought ${amount} bitcoin for ${amount * price} mystic credits!`)
                ]});
                return;
            }
        }
    }
}

module.exports = BuyBitcoin;