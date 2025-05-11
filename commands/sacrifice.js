const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');

class Sacrifice extends Command {
  constructor(client) {
    super(client, 'sacrifice', 'sacrifice 3 pokemons to summon a random pokemon (you need to catch it back)', [{
      name: 'pokemon1',
      description: 'the first pokemon to sacrifice',
      type: 3,
      required: true,
    },
    {
      name: 'pokemon2',
      description: 'the second pokemon to sacrifice',
      type: 3,
      required: true,
    },
    {
      name: 'pokemon3',
      description: 'the third pokemon to sacrifice',
      type: 3,
      required: true,
    }]);
  }

  async run(interaction) {
    const pokemon1 = interaction.options.getString('pokemon1');
    const pokemon2 = interaction.options.getString('pokemon2');
    const pokemon3 = interaction.options.getString('pokemon3');
    const userId = interaction.user.id;

    const pokemonCount1 = await this.client.db.getPokemonCount(userId, pokemon1);
    const pokemonCount2 = await this.client.db.getPokemonCount(userId, pokemon2);
    const pokemonCount3 = await this.client.db.getPokemonCount(userId, pokemon3);

    if (pokemonCount1 < 1 || pokemonCount2 < 1 || pokemonCount3 < 1
            || (pokemon1 == pokemon2 && pokemonCount1 < 2)
            || (pokemon2 == pokemon3 && pokemonCount2 < 2)
            || (pokemon3 == pokemon1 && pokemonCount3 < 2)
            || (pokemon1 == pokemon2 && pokemon2 == pokemon3 && pokemonCount1 < 3)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setDescription('You don\'t have all the selected pokemons.')
            .setColor('Red'),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`Sacrificing ${pokemon1}, ${pokemon2}, and ${pokemon3}...`)
          .setColor('Green'),
      ],
    });

    await this.client.db.sacrificePokemon(userId, pokemon1);
    await this.client.db.sacrificePokemon(userId, pokemon2);
    await this.client.db.sacrificePokemon(userId, pokemon3);

    const handler = await this.client.getHandler(); // Get the current seasonal handler
    await handler.summonPokemon(interaction); // Use handler's summonPokemon with the specified mode
  }
}

module.exports = Sacrifice;
