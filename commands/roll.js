const Discord = require('discord.js');
const { Command } = require('./classes/command');

class Roll extends Command {
  constructor(client) {
    super(
      client,
      'roll',
      'roll a dice',
      [{
        name: 'sides',
        description: 'number of sides. wait, why is it a string?',
        type: 3,
        required: false,
      }],
    );
  }

  async run(interaction) {
    const input = interaction.options.getString('sides') || '6';
    let embed;
    switch (input) {
      case '0':
        embed = new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setDescription('### You tried rolling a 0-sided die.\nWait, where did it go?');
        break;
      case '1':
        embed = new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setDescription('### You tried rolling a 1-sided die.\nOr, a sphere. It landed on a 1. Like, what did you expect?');
        break;
      case '2':
        if (Math.random() < 0.2) {
          embed = new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setDescription('### You tried rolling a 2-sided die.\nOr let\'s call it a coin. And it landed on the edge.');
        } else {
          var result = Math.ceil(Math.random() * 2);
          embed = new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setDescription(`### You tried rolling a 2-sided die.\nOr let's call it a coin. It landed on a ${result}.`);
        }
        break;
      case '3':
        var result = Math.ceil(Math.random() * 3);
        embed = new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setDescription(`### You tried rolling a 3-sided die.\nI have no fucking idea what it's supposed to look like. But it landed on a ${result}.`);
        break;
      case 'pi':
        embed = new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setDescription('### You tried rolling a 3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196442881097566593344612847564823378678316527120190914564856692346034861045432664821339360726024914127372458700660631558817488152092096282925409171536436...');
        break;
      default:
        if (input.includes('smug')) {
          embed = new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setDescription(`### You tried rolling a ${input}-sided die.\n<:yanfeismug:1136925353651228775>`);
        } else {
          const faces = parseInt(input);
          if (isNaN(faces) || faces === undefined) {
            embed = new Discord.EmbedBuilder()
              .setColor('#AA0000')
              .setDescription(`### You tried rolling a ${input}-sided die.\nIt landed on a ${input}. Pretty cool, huh?`);
          } else if (faces !== Math.round(faces)) {
            embed = new Discord.EmbedBuilder()
              .setColor('#AA0000')
              .setDescription(`### You tried rolling a ${faces}-sided die.\nIt landed on an edge with an incomplete side.`);
          } else if (faces < 0) {
            var result = -Math.ceil(Math.random() * -faces);
            embed = new Discord.EmbedBuilder()
              .setColor('#00AA00')
              .setDescription(`### You rolled a ${faces}-sided die.\nI dont know how, but apparently it worked. It landed on a ${result}.`);
          } else if (faces > 1000) {
            var result = Math.ceil(Math.random() * faces);
            embed = new Discord.EmbedBuilder()
              .setColor('#AA0000')
              .setDescription(`### You tried rolling a ${faces}-sided die.\nAt this point you might as well as call it a sphere. It landed on a ${result}.`);
          } else {
            var result = Math.ceil(Math.random() * faces);
            embed = new Discord.EmbedBuilder()
              .setColor('#00AA00')
              .setDescription(`### You rolled a ${faces}-sided die.\nIt landed on a ${result}. Boring.`);
          }
        }
    }
    interaction.editReply({ embeds: [embed] });
  }
}

module.exports = Roll;
