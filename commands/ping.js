const { Command } = require("./classes/command.js");

class Ping extends Command {
    constructor(client){
        super(client, "ping", "pong", []);
    }

    async run(interaction){
        await interaction.editReply("Pong!");
    }
}

module.exports = Ping;