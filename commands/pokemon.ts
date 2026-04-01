import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class Pokemon extends Command {
  itemsPerPage: number;

  constructor(client: any) {
    super(client, 'pokemon', 'list your pokemons?', [], { blame: 'ei' });
    this.itemsPerPage = 20;
  }

  async run(interaction: any): Promise<void> {
    try {
      const allPokemons = await this.client.db.pokemon.getPokemons(interaction.user.id);
      allPokemons.sort((a: any, b: any) => a.pokemonName.localeCompare(b.pokemonName));

      let currentPage = 0;
      const totalCount = allPokemons.length;
      const maxPage = Math.ceil(totalCount / this.itemsPerPage) - 1;

      const generateEmbed = (page: number) => {
        const pagePokemons = allPokemons.slice(page * this.itemsPerPage, (page + 1) * this.itemsPerPage);
        const maxNameLength = Math.max(...pagePokemons.map(
          (pokemon: any) => pokemon.pokemonName.length,
        ));
        const description = pagePokemons.map(
          (pokemon: any) => `${pokemon.pokemonName.padEnd(maxNameLength + 2)} ${pokemon.pokemonCount}`,
        ).join('\n');

        return new EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Your Pokémons')
          .setDescription(`\`\`\`${description}\`\`\``)
          .setFooter({ text: `Page ${page + 1} of ${maxPage + 1}` });
      };

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

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      const collector = message.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (i: any) => {
        if (i.customId === 'prevPage' && currentPage > 0) {
          currentPage -= 1;
        } else if (i.customId === 'nextPage' && currentPage < maxPage) {
          currentPage += 1;
        }

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

        await i.update({ embeds: [newEmbed], components: [newRow] });
      });

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
      logError('Failed to retrieve Pokémon list:', error);
      await interaction.editReply({ content: 'Failed to retrieve Pokémon list', ephemeral: true });
    }
  }
}

export default Pokemon;
