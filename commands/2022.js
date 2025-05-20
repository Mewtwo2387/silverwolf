const Discord = require('discord.js');
const quotes = require('../data/2022.json');
const { Command } = require('./classes/command.js');

class OldTGP extends Command {
  constructor(client) {
    super(client, '2022', '2022 flashbacks', []);
  }

  async run(interaction) {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const embed = new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setDescription(`*"${quote.quote}"* - ${quote.author}`);
    if (quote.reply !== undefined) {
      embed.setDescription(`*"${quote.quote}"* - ${quote.author}\n*"${quote.reply}"* - ${quote.replyauthor}`);
    }
    interaction.editReply({ embeds: [embed] });
  }
}

module.exports = OldTGP;
