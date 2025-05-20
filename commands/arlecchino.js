const { EmbedBuilder } = require('discord.js');
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Command } = require('./classes/command.js');
const { logError } = require('../utils/log');

class arlecchino extends Command {
  constructor(client) {
    super(client, 'arlecchino', 'scare leon away', []);
  }

  async run(interaction) {
    try {
      const gifsPath = path.join(__dirname, '../data/arlecchino.json');
      const gifs = JSON.parse(fs.readFileSync(gifsPath, 'utf8'));
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      await interaction.editReply({ content: randomGif });
      await interaction.followUp({ content: '<@993614772354416673>' });
    } catch (error) {
      logError('Error fetching arlecchino GIF:', error);
      await interaction.editReply({ content: 'Sorry, I couldn’t fetch a arlecchino GIF. Please try again later.', ephemeral: true });
    }
  }
}

module.exports = arlecchino;
