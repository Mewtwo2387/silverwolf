const { DevCommand } = require("./classes/devcommand.js");

class ForceSummon extends DevCommand {
    constructor(client){
        super(client, "forcesummon", "force summon a pokemon", [
            {
                name: "mode",
                description: "mode",
                type: 3,
                required: false,
                choices: [
                    { name: "normal", value: "normal" },
                    { name: "shiny", value: "shiny" },
                    { name: "mystery", value: "mystery" },
                ]
            }
        ], true);
    }

    async run(interaction){
        const mode = interaction.options.getString("mode") || "normal";
        await this.client.summonPokemon(interaction, mode);
    }
}

module.exports = ForceSummon;

