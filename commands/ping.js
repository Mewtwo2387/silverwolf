const { Command } = require("./classes/command.js");

class Ping extends Command {
    constructor(client){
        super(client, "regular", "pong", [], {isSubcommand: false});
    }

    async run(interaction){
        await interaction.editReply("Pong!");
    }
}

module.exports = Ping;