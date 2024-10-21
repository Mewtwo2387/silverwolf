const { Command } = require('./classes/command.js');
const { EmbedBuilder} = require('discord.js'); 
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

class arlecchino extends Command {
    constructor(client) {
        super(client, "arlecchino", "scare leon away", []);
    }

    async run(interaction) {
        try {
            const gifsPath = path.join(__dirname, '../data/arlecchino.json');
            const gifs = JSON.parse(fs.readFileSync(gifsPath, 'utf8'));
            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
            await interaction.editReply({ content: randomGif });
        } catch (error) {
            console.error('Error fetching arlecchino GIF:', error);
            await interaction.editReply({ content: 'Sorry, I couldn’t fetch a arlecchino GIF. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = arlecchino;