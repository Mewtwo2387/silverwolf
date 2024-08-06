const { Command } = require('./classes/command.js');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js'); // Ensure you're importing EmbedBuilder

class CatFactCommand extends Command {
    constructor(client) {
        super(client, "cat-fact", "Fetch a random cat fact", []);
    }

    async run(interaction) {
        const catFactUrl = 'https://catfact.ninja/fact';
        try {
          const response = await axios.get(catFactUrl);
          const data = response.data;
      
          const embed = new EmbedBuilder()
            .setTitle('Cat Fact')
            .setColor(0x3498db)
            .setDescription(data.fact);
      
          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error(error);
          await interaction.editReply({ content: 'Failed to retrieve cat fact. Please try again later.', ephemeral: true });
        }
      }
      
}

module.exports = CatFactCommand;
