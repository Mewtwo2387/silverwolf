const { DevCommand } = require("./classes/devcommand.js");

class DPing extends DevCommand {
    constructor(client){
        super(client, "dping", "pong but for dev", []);
    }

    async run(interaction){
        await interaction.reply("Pong!");
    }
}

module.exports = DPing;