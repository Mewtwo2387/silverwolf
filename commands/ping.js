const { Command } = require("./classes/command.js");

class Ping extends Command {
    constructor(client){
        super(client, "ping", "pong", []);
    }

    async run(interaction){
        await interaction.reply("Pong!");
    }
}

module.exports = Ping;