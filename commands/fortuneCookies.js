const { Command } = require('./classes/command.js');
const fs = require('fs');
const path = require('path');

class FortuneCookieCommand extends Command {
    constructor(client) {
        super(client, "fortune", "Get your daily fortune cookie!");
    }

    async run(interaction) {
        const filePath = path.join(__dirname, '../data/fortune.json');
        const data = fs.readFileSync(filePath);
        const fortunes = JSON.parse(data).fortunes;

        const randomIndex = Math.floor(Math.random() * fortunes.length);
        const fortune = fortunes[randomIndex];

        await interaction.editReply(`🥠 Your fortune: "${fortune}"`);
    }
}

module.exports = FortuneCookieCommand;
