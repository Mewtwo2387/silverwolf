const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');

class Catch extends Command {
    constructor(client) {
        super(client, "catch", "gotta catch em all", [
            {
                name: "pokemon",
                description: "the name of the uhh.. pokemon?",
                type: 3,
                required: true
            }
        ]);
    }

    async run(interaction){
        const pokemonName = interaction.options.getString("pokemon");
        const currentPokemon = this.client.currentPokemon;
        if (!currentPokemon) {
            await interaction.editReply({ embeds: [new EmbedBuilder()
                .setTitle(`There's no pokemon to catch`)
                .setColor("#FF0000")
            ]})
            return;
        }
        if (currentPokemon.toLowerCase() == pokemonName.toLowerCase()) {
            await interaction.editReply({ embeds: [new EmbedBuilder()
                .setTitle(`You caught a wild ${pokemonName}!`)
                .setDescription(`Ummm congrats I guess?`)
                .setColor("#00FF00")
            ]})
            this.client.db.catchPokemon(interaction.user.id, pokemonName);
            this.client.currentPokemon = null;
        } else {
            await interaction.editReply({ embeds: [new EmbedBuilder()
                .setTitle(`There's no pokemon with that name to catch`)
                .setColor("#FF0000")
            ]})
        }
    }
}

module.exports = Catch;