const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');

class Catcg extends Command {
  constructor(client) {
    super(client, 'catcg', 'gotta catcg em all', [
      {
        name: 'pokenom',
        description: 'the pokenom to catcg',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const pokemons = await this.client.db.pokemon.getPokemons(interaction.user.id);
    if (pokemons.length > 0) {
      const pokemon = pokemons[Math.floor(Math.random() * pokemons.length)];
      await this.client.db.pokemon.sacrificePokemon(interaction.user.id, pokemon.pokemonName);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('You used the wrong catch command!')
          .setDescription(`A random pokemon you own, ${pokemon.pokemonName}, was released.`)
          .setColor('#FF0000'),
        ],
      });
      return;
    }
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('You used the wrong catch command!')
        .setColor('#FF0000'),
      ],
    });
  }
}

module.exports = Catcg;
