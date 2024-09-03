const { Command } = require('./classes/command.js');
const fs = require('fs');
const path = require('path');

class MisfortuneCookieCommand extends Command {
    constructor(client) {
        super(client, "misfortune", "Get your hilariously unfortunate misfortune cookie!");
    }

    async run(interaction) {
        const filePath = path.join(__dirname, '../data/misfortune.json');
        const data = fs.readFileSync(filePath);
        const misfortunes = JSON.parse(data).misfortunes;

        const randomIndex = Math.floor(Math.random() * misfortunes.length);
        const misfortune = misfortunes[randomIndex];

        await interaction.editReply(`🥠☠Your misfortune : "${misfortune}"`);
    }
}

module.exports = MisfortuneCookieCommand;
