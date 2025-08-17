const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format, antiFormat } = require('../utils/math');

class Transfer extends Command {
  constructor(client) {
    super(client, 'transfer', 'transfer mystic credits to another user (taxed)', [
      {
        name: 'user',
        description: 'the user to transfer to',
        type: 6,
        required: true,
      },
      {
        name: 'amount',
        description: 'the amount of credits to transfer',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const target = interaction.options.getUser('user');
    const amountString = interaction.options.getString('amount');
    const amount = antiFormat(amountString);
    if (Number.isNaN(amount)) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid amount')
          .setDescription('idk if this parsing actually works'),
        ],
      });
      return;
    }

    const credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');

    if (amount < 0) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You can\'t transfer debt!'),
        ],
      });
      return;
    }

    const { give, receive, description } = this.calculateTransferDetails(amount, target);

    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#AA0000')
        .setTitle(`Transferring ${format(amount)} credits to ${target.username}...`)
        .setDescription(description),
      ],
    });

    if (give > credits) {
      await interaction.followUp({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You don\'t have enough credits!'),
        ],
      });
    } else {
      await this.client.db.user.addUserAttr(interaction.user.id, 'credits', -give);
      await this.client.db.user.addUserAttr(target.id, 'credits', receive);
      await interaction.followUp({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(`Successfully transferred ${format(amount)} credits to ${target.username}!`)
          .setDescription(`You paid ${format(give)} credits and ${target.username} received ${format(receive)} credits.`)
          .setFooter({ text: 'No you don\'t have a choice to cancel. We took your money already.' }),
        ],
      });
    }
  }

  calculateTransferDetails(amount, target) {
    const tiers = [
      {
        threshold: 10000000, giveFactor: 2.75, receiveFactor: 0.001, taxLevel: 3, smallFee: 0,
      },
      {
        threshold: 1000000, giveFactor: 2.15, receiveFactor: 0.01, taxLevel: 2, smallFee: 0,
      },
      {
        threshold: 100000, giveFactor: 1.75, receiveFactor: 0.05, taxLevel: 1, smallFee: 0,
      },
      {
        threshold: -1, giveFactor: 1.5, receiveFactor: 0.25, smallFee: 10000,
      },
    ];

    const tier = tiers.find((t) => amount > t.threshold);

    return {
      give: amount * tier.giveFactor + tier.smallFee,
      receive: amount * tier.receiveFactor,
      description: `**You pay:**
Amount: ${format(amount)}
VAT: ${format(amount * 0.25)}
Electricity fee: ${format(amount * 0.1)}
Transaction fee: ${format(amount * 0.15)}${tier.smallFee > 0 ? `\nSmall transfer fee: ${format(tier.smallFee)}` : ''}${tier.taxLevel > 0 ? `\nBig transfer fee (>100k): ${format(amount * 0.2)}` : ''}${tier.taxLevel > 1 ? `\nHuge transfer fee (>1m): ${format(amount * 0.4)}` : ''}${tier.taxLevel > 2 ? `\nYourmom transfer fee (>10m): ${format(amount * 0.6)}` : ''}
**Total: ${format(amount * tier.giveFactor + tier.smallFee)}**

**${target.username} receives:**
Amount: ${format(amount)}
VAT: ${format(amount * -0.25)}
Transfer tax: ${format(amount * -0.2)}${tier.taxLevel > 0 ? `\nBig transfer tax (>100k): ${format(amount * -0.2)}` : ''}${tier.taxLevel > 1 ? `\nHuge transfer tax (>1m): ${format(amount * -0.04)}` : ''}${tier.taxLevel > 2 ? `\nYourmom transfer tax (>10m): ${format(amount * -0.009)}` : ''}
**Total: ${format(amount * tier.receiveFactor)}**`,
    };
  }
}

module.exports = Transfer;
