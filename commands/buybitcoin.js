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
        let credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        let bitcoinAmount = await this.client.db.getUserAttr(interaction.user.id, 'bitcoin');


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
                await this.client.db.updateUserAttr(interaction.user.id, 'bitcoin', amount);
                await this.client.db.updateUserAttr(interaction.user.id, 'credits', -amount * price);
                await this.client.db.updateUserAttr(interaction.user.id, 'total_sold_amount', -amount);
                await this.client.db.updateUserAttr(interaction.user.id, 'total_sold_price', -amount * price);
                bitcoinAmount = await this.client.db.getUserAttr(interaction.user.id, 'bitcoin');
                credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
                const lastBoughtAmount = await this.client.db.getUserAttr(interaction.user.id, 'last_bought_amount');
                const lastBoughtPrice = await this.client.db.getUserAttr(interaction.user.id, 'last_bought_price');
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Sold ${-amount} bitcoin for ${-amount * price} mystic credits!`)
                    .setDescription(`Current bitcoin price: ${price}
Last bought price: ${lastBoughtPrice} (${lastBoughtAmount} bitcoin)
Current bitcoin amount: ${bitcoinAmount}
Current mystic credits: ${credits}`)
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
                await this.client.db.updateUserAttr(interaction.user.id, 'bitcoin',  amount);
                await this.client.db.updateUserAttr(interaction.user.id, 'credits', -amount * price);
                await this.client.db.updateUserAttr(interaction.user.id, 'total_bought_amount', amount);
                await this.client.db.updateUserAttr(interaction.user.id, 'total_bought_price', amount * price);
                await this.client.db.setUserAttr(interaction.user.id, 'last_bought_amount', amount);
                await this.client.db.setUserAttr(interaction.user.id, 'last_bought_price', price);
                bitcoinAmount = await this.client.db.getUserAttr(interaction.user.id, 'bitcoin');
                credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Bought ${amount} bitcoin for ${amount * price} mystic credits!`)
                    .setDescription(`Current bitcoin price: ${price}
Current bitcoin amount: ${bitcoinAmount}
Current mystic credits: ${credits}`)
                ]});
                return;
            }
        }
    }
}

module.exports = BuyBitcoin;