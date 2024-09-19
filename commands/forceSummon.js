const { DevCommand } = require("./classes/devcommand.js");

class ForceSummon extends DevCommand {
    constructor(client){
        super(client, "forcesummon", "force summon a pokemon", [], true);
    }

    async run(interaction){
        await this.client.summonPokemon(interaction);
    }
}

module.exports = ForceSummon;

