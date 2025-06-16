const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const { checkValidBet } = require('../utils/betting');

class Slots extends Command {
  constructor(client) {
    super(client, 'slots', 'lose all your mystic credits', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    const season = await this.client.db.getGlobalConfig('season') || 'Normal';

    const skin = await JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config/skin/slots.json'), 'utf8'))[season];

    const smugs = skin.emotes;

    const results = [[], [], []];

    for (var i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        results[i].push(smugs[Math.floor(Math.random() * smugs.length)]);
      }
    }

    let multi = 0;

    const lines = [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [0, 0, 0, 1, 2], [2, 2, 2, 1, 0]];

    for (var i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote && results[line[2]][2].emote === results[line[3]][3].emote && results[line[3]][3].emote === results[line[4]][4].emote) {
        multi += results[line[0]][0].value * 20;
      } else if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote && results[line[2]][2].emote === results[line[3]][3].emote) {
        multi += results[line[0]][0].value * 4;
      } else if (results[line[0]][0].emote === results[line[1]][1].emote && results[line[1]][1].emote === results[line[2]][2].emote) {
        multi += results[line[1]][1].value;
      }
    }

    if (amount >= 0) {
      multi *= await this.client.db.marriage.getMarriageBenefits(interaction.user.id);
      const winnings = multi * amount;
      await this.client.db.addUserAttr(interaction.user.id, 'slotsTimesPlayed', 1);
      await this.client.db.addUserAttr(interaction.user.id, 'slotsTimesGambled', amount);
      await this.client.db.addUserAttr(interaction.user.id, 'slotsTimesWon', multi > 0 ? 1 : 0);
      await this.client.db.addUserAttr(interaction.user.id, 'slotsAmountWon', winnings);
      await this.client.db.addUserAttr(interaction.user.id, 'slotsRelativeWon', multi);
      await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings - amount);
      if (multi === 0) {
        const loseMessage = skin.loseMessage.replace('{amount}', format(amount));
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle(loseMessage)
            .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`),
          ],
        });
      } else {
        const winMessage = skin.winMessage.replace('{amount}', format(amount)).replace('{winnings}', format(winnings));
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(winMessage)
            .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`),
          ],
        });
      }
    } else {
      // await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings - amount);
      // if (winnings === 0){
      //     await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
      //         .setColor('#AA0000')
      //         .setTitle(`You bet ${amount} mystic credits of debt and got rid of all the debt!`)
      //         .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
      //     ]});
      // }else{
      //     await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
      //         .setColor('#00AA00')
      //         .setTitle(`You bet ${amount} mystic credits of debt and won ${winnings} mystic credits of debt!`)
      //         .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
      //     ]});
      // }
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Betting debt is temporarily disabled'),
        ],
      });
    }
  }
}

module.exports = Slots;
