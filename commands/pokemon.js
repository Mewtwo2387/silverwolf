const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { Command } = require('./classes/command');

class Pokemon extends Command {
  constructor(client) {
    super(client, 'pokemon', 'list your pokemons?', []);
    this.itemsPerPage = 20; // Show 20 Pokémon per page
  }

  async run(interaction) {
    try {
      // Fetch all Pokémon from the database for the user
      const allPokemons = await this.client.db.pokemon.getPokemons(interaction.user.id);
      allPokemons.sort((a, b) => a.pokemonName.localeCompare(b.pokemonName));

      // Set up initial page data
      let currentPage = 0;
      const totalCount = allPokemons.length;
      const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;

      // Helper function to generate the embed for a given page
      const generateEmbed = (page) => {
        const pagePokemons = allPokemons.slice(page * this.itemsPerPage, (page + 1) * this.itemsPerPage);
        const maxNameLength = Math.max(...pagePokemons.map(
          (pokemon) => pokemon.pokemonName.length,
        ));
        const description = pagePokemons.map(
          (pokemon) => `${pokemon.pokemonName.padEnd(maxNameLength + 2)} ${pokemon.pokemonCount}`,
        ).join('\n');

        return new EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Your Pokémons')
          .setDescription(`\`\`\`${description}\`\`\``)
          .setFooter({ text: `Page ${page + 1} of ${maxPage + 1}` });
      };

      // Generate the embed and action row for the first page
      const embed = generateEmbed(currentPage);
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prevPage')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('nextPage')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === maxPage),
        );

      // Send the initial message
      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Handle pagination
      const collector = message.createMessageComponentCollector({ time: 60000 }); // 1 minute timeout

      collector.on('collect', async (i) => {
        if (i.customId === 'prevPage' && currentPage > 0) {
          currentPage -= 1;
        } else if (i.customId === 'nextPage' && currentPage < maxPage) {
          currentPage += 1;
        }

        // Update the embed and buttons for the new page
        const newEmbed = generateEmbed(currentPage);
        const newRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prevPage')
              .setLabel('⬅️ Back')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId('nextPage')
              .setLabel('Next ➡️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentPage === maxPage),
          );

        // Update the message with the new embed and row
        await i.update({ embeds: [newEmbed], components: [newRow] });
      });

      // Disable buttons when collector ends
      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prevPage')
              .setLabel('⬅️ Back')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('nextPage')
              .setLabel('Next ➡️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
          );
        await message.edit({ components: [disabledRow] });
      });
    } catch (error) {
      console.error('Failed to retrieve Pokémon list:', error);
      await interaction.editReply({ content: 'Failed to retrieve Pokémon list', ephemeral: true });
    }
  }
}

module.exports = Pokemon;
