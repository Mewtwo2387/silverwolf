const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { Bitcoin } = require('../classes/bitcoin');
const { format } = require('../utils/math');

class BuyBitcoin extends Command {
  constructor(client) {
    super(client, 'buybitcoin', 'buy bitcoin with mystic credits', [
      {
        name: 'amount',
        description: 'the amount of bitcoin to buy (negative to sell)',
        type: 10,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const bitcoin = new Bitcoin();
    const amount = interaction.options.getNumber('amount');
    const price = await bitcoin.getPrice();
    if (price === null) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Failed to get bitcoin price'),
        ],
      });
      return;
    }

    let credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');
    let bitcoinAmount = await this.client.db.user.getUserAttr(interaction.user.id, 'bitcoin');

    if (price === null) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Failed to get bitcoin price'),
        ],
      });
      return;
    }

    if (amount === 0) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You bought gamebang\'s pp!'),
        ],
      });
    } else if (amount < 0) {
      if (bitcoinAmount < -amount) {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle('You don\'t have that much bitcoin to sell smh'),
          ],
        });
      } else {
        await this.client.db.user.addUserAttr(interaction.user.id, 'bitcoin', amount);
        await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -amount * price);
        await this.client.db.user.addUserAttr(interaction.user.id, 'totalSoldAmount', -amount);
        await this.client.db.user.addUserAttr(interaction.user.id, 'totalSoldPrice', -amount * price);
        bitcoinAmount = await this.client.db.user.getUserAttr(interaction.user.id, 'bitcoin');
        credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');
        const lastBoughtAmount = await this.client.db.user.getUserAttr(interaction.user.id, 'lastBoughtAmount');
        const lastBoughtPrice = await this.client.db.user.getUserAttr(interaction.user.id, 'lastBoughtPrice');
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`Sold ${-amount} bitcoin for ${format(-amount * price)} mystic credits!`)
            .setDescription(`Current bitcoin price: ${format(price)}
Last bought price: ${format(lastBoughtPrice)} (${lastBoughtAmount} bitcoin)
Current bitcoin amount: ${bitcoinAmount}
Current mystic credits: ${format(credits)}`),
          ],
        });
      }
    } else if (credits < amount * price) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You\'re too poor to buy that much bitcoin smh'),
        ],
      });
    } else {
      await this.client.db.user.addUserAttr(interaction.user.id, 'bitcoin', amount);
      await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -amount * price);
      await this.client.db.user.addUserAttr(interaction.user.id, 'totalBoughtAmount', amount);
      await this.client.db.user.addUserAttr(interaction.user.id, 'totalBoughtPrice', amount * price);
      await this.client.db.user.addUserAttr(interaction.user.id, 'lastBoughtAmount', amount);
      await this.client.db.user.addUserAttr(interaction.user.id, 'lastBoughtPrice', price);
      bitcoinAmount = await this.client.db.user.getUserAttr(interaction.user.id, 'bitcoin');
      credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(`Bought ${amount} bitcoin for ${format(amount * price)} mystic credits!`)
          .setDescription(`Current bitcoin price: ${format(price)}
Current bitcoin amount: ${bitcoinAmount}
Current mystic credits: ${format(credits)}`),
        ],
      });
    }
  }
}

module.exports = BuyBitcoin;
