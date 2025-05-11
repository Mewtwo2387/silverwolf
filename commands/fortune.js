const fs = require('fs');
const path = require('path');
const { Command } = require('./classes/command');

class FortuneCookieCommand extends Command {
  constructor(client) {
    super(client, 'fortune', 'how desperate are you to munch virtual fortune cookies ?');
  }

  async run(interaction) {
    const filePath = path.join(__dirname, '../data/fortune.json');
    const data = fs.readFileSync(filePath);
    const { fortunes } = JSON.parse(data);

    const randomIndex = Math.floor(Math.random() * fortunes.length);
    const fortune = fortunes[randomIndex];

    await interaction.editReply(`🥠 Your fortune: "${fortune}"`);
  }
}

module.exports = FortuneCookieCommand;
