const Discord = require('discord.js');
const axios = require('axios');
const { Command } = require('./classes/command.js'); // Adjust the path if necessary

class BitcoinPriceCommand extends Command {
    constructor(client) {
        super(client, "bitcoin-price", "Fetches the current Bitcoin price", []);
        this.bitcoinPriceUrl = 'https://api.coindesk.com/v1/bpi/currentprice.json';
    }

    async run(interaction) {
        try {
            // Fetch Bitcoin price data
            const response = await axios.get(this.bitcoinPriceUrl);
            const data = response.data;
            const date = new Date(data.time.updatedISO);

            // Create the embed message
            const embed = new Discord.EmbedBuilder()
                .setTitle('Current Bitcoin Price')
                .setDescription(`As of ${date.toLocaleString()}`)
                .setFooter({ text: data.disclaimer, iconURL: 'https://th.bing.com/th/id/R.4077e337bac40b4e403a6ac336ac44b5?rik=uJ8OajioCe%2b%2b5g&riu=http%3a%2f%2ftech.eu%2fwp-content%2fuploads%2f2014%2f04%2fbitcoin.jpg&ehk=ON6Qtu9zJQwNIkoWtVz%2fy2pkZ8bITim2azHWPWkyoY4%3d&risl=&pid=ImgRaw&r=0' });

            // Add fields for each currency with formatted values
            const fields = [];
            for (const currency in data.bpi) {
                const priceData = data.bpi[currency];
                fields.push({
                    name: `${priceData.code} (${priceData.symbol})`,
                    value: `**Rate:** ${priceData.rate} ${priceData.symbol}`,
                    inline: true // Display fields inline (side-by-side)
                });
            }

            // Add all fields to the embed using addFields
            embed.addFields(fields);
            
            // Send the embed message
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            if (!interaction.replied) {
                await interaction.editReply({ content: 'Failed to retrieve Bitcoin price. Please try again later.', ephemeral: true });
            }
        }
    }
}


module.exports = BitcoinPriceCommand;