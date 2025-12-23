const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class PokemonFind extends Command {
  constructor(client) {
    super(client, 'pokemonfind', 'Find users with Pokemon of a specific type', [
      {
        name: 'type',
        description: 'The type of Pokemon to search for',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const type = interaction.options.getString('type').toLowerCase().trim();

    try {
      const rows = await this.client.db.pokemon.getUsersWithPokemon(type);
      if (rows.length === 0) {
        interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`No users found with ${type}`),
          ],
        });
        return;
      }

      const userList = rows.map((row) => {
        const user = this.client.users.cache.get(row.userId)?.username ?? `<@${row.userId}>`;

        return `${user}: ${row.pokemonCount}`;
      });

      const itemsPerPage = 10;
      let currentPage = 0;
      const totalPages = Math.ceil(userList.length / itemsPerPage);

      const getNextPage = (index) => userList.slice(index, index + itemsPerPage).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`Users with ${type}`)
        .setDescription(`\`\`\`${getNextPage(currentPage)}\`\`\``)
        .setFooter({ text: `Page ${currentPage + 1} of ${totalPages}` });

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
            .setDisabled(currentPage === totalPages),
        );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      const collector = message.createMessageComponentCollector({ time: 60000 }); // 1 minute timeout

      collector.on('collect', async (i) => {
        if (i.customId === 'prevPage' && currentPage > 0) {
          currentPage -= 1;
        } else if (i.customId === 'nextPage' && currentPage < totalPages) {
          currentPage += 1;
        }

        const nextPage = getNextPage(currentPage);
        embed.setDescription(`\`\`\`${nextPage}\`\`\``)
          .setFooter({ text: `Page ${currentPage + 1} of ${totalPages}` });

        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === totalPages - 1);

        await i.update({ embeds: [embed], components: [row] });
      });

      collector.on('end', async () => {
        row.components.forEach((c) => c.setDisabled(true));

        await message.edit({ components: [row] });
      });
    } catch (error) {
      logError('Failed to retrieve hasPokemon list.', error);
      interaction.editReply({ content: 'Failed to retrieve list.', ephemeral: true });
    }
  }
}

module.exports = PokemonFind;
