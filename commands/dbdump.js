const { DevCommand } = require("./classes/devcommand.js");
const Discord = require('discord.js');

class DBDump extends DevCommand {
    constructor(client){
        super(client, "dbdump", "output whole db", []);
    }

    async run(interaction){
        const data = await this.client.db.dump();
        await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Data')
            .setDescription(data)
        ]});
        const pokemonData = await this.client.db.dumpPokemon();
        await interaction.followUp({ embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Pokemon Data')
            .setDescription(pokemonData)
        ]});
    }
}

module.exports = DBDump;