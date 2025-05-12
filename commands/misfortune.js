const fs = require('fs');
const path = require('path');
const { Command } = require('./classes/command.js');

class MisfortuneCookieCommand extends Command {
  constructor(client) {
    super(client, 'misfortune', 'how bad is your day that you are munching virtual misfortune cookies ?');
  }

  async run(interaction) {
    const filePath = path.join(__dirname, '../data/misfortune.json');
    const data = fs.readFileSync(filePath);
    const { misfortunes } = JSON.parse(data);

    const randomIndex = Math.floor(Math.random() * misfortunes.length);
    const misfortune = misfortunes[randomIndex];

    await interaction.editReply(`🥠☠Your misfortune : "${misfortune}"`);
  }
}

module.exports = MisfortuneCookieCommand;
