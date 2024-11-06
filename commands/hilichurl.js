const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logError } = require('../utils/log');

class Hilichurl extends Command {
    constructor(client) {
        super(client, "hilichurl", "our 69th command", []);
    }

    async run(interaction) {
        try {
            // Read the GIFs from the JSON file
            const gifsPath = path.join(__dirname, '../data/hilichurl.json');
            const gifs = JSON.parse(fs.readFileSync(gifsPath, 'utf8'));

            // Select a random GIF
            const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

            // // Send the random GIF in an embed
            // const embed = new Discord.EmbedBuilder()
            //     .setTitle('Random Hilichurl GIF')
            //     .setColor('#FFD700')
            //     .setImage(randomGif) // Attach the GIF
            //     .setTimestamp()
            //     .setFooter({ text: 'Enjoy your Hilichurl!' });

            // Respond with the embed
            await interaction.editReply({ content: randomGif });
        } catch (error) {
            logError('Error fetching Hilichurl GIF:', error);
            await interaction.editReply({ content: 'Sorry, I couldn’t fetch a Hilichurl GIF. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = Hilichurl;
