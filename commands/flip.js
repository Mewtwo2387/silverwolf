const Discord = require('discord.js');
const { Command } = require('./classes/command');

class Flip extends Command {
  constructor(client) {
    super(client, 'flip', '50/50 for silverwolf to give you head', []);
  }

  async run(interaction) {
    let embed;
    if (Math.random() < 0.49) {
      embed = new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('You flipped a coin.')
        .setDescription('Silverwolf gave you head.');
    } else if (Math.random() < 0.98) {
      embed = new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('You flipped a coin.')
        .setDescription('Silverwolf gave you tail.');
    } else {
      embed = new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('You flipped a coin.')
        .setDescription('Silverwolf gave you side.');
    }
    interaction.editReply({ embeds: [embed] });
  }
}

module.exports = Flip;
