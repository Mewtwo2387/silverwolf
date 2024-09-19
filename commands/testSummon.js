const { DevCommand } = require("./classes/devcommand.js");

class TestSummon extends DevCommand {
    constructor(client){
        super(client, "testsummon", "summon a pokemon at random intervals", [], true);
    }

    async run(interaction){
        this.nextSummon(interaction);
    }

    async nextSummon(interaction){
        const randomInterval = Math.floor(Math.random() * 60 * 60 * 1000) + 20 * 60 * 1000;
        setTimeout(async () => {
            await this.client.summonPokemon(interaction);
            this.nextSummon(interaction);
        }, randomInterval);
    }
}

module.exports = TestSummon;

