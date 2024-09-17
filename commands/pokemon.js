const { Command } = require("./classes/command.js");
const { EmbedBuilder } = require('discord.js');

class Pokemon extends Command {
    constructor(client){
        super(client, "pokemon", "list your pokemons?", []);
    }

    async run(interaction){
        const pokemons = await this.client.db.getPokemons(interaction.user.id);

        const maxNameLength = Math.max(...pokemons.map(pokemon => pokemon.pokemon_name.length));

        const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Your Pokemons')
        .setDescription(`\`\`\`${pokemons.map(pokemon =>
            `${pokemon.pokemon_name.padEnd(maxNameLength + 2)} ${pokemon.pokemon_count}`
        ).join('\n')}\`\`\``);

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = Pokemon;
