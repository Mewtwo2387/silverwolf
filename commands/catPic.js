const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const axios = require('axios');

class CatPic extends Command {
    constructor(client) {
        super(client, "cat_pic", "Fetch a random cat picture", []);
    }

    async run(interaction) {
        try {
            // Make the request to the cat API
            const response = await axios.get('https://api.thecatapi.com/v1/images/search');

            // Check if the response has data
            if (!response.data || response.data.length === 0) {
                throw new Error('No cat picture found.');
            }

            // Extract the relevant data from the response
            const cat = response.data[0];
            const catImageUrl = cat.url;
            const catId = cat.id;

            // Create the embed with the cat image
            const embed = new Discord.EmbedBuilder()
                .setTitle('Found a cat! 🐈')
                .setImage(catImageUrl)
                .setFooter({ text: `Cat ID: ${catId}` });

            // Send the embed to the interaction
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            // Error handling if the request fails or no cat image is found
            console.error('Error fetching cat picture:', error);
            await interaction.editReply({ content: 'Sorry, I couldn’t fetch a cat picture. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = CatPic;
