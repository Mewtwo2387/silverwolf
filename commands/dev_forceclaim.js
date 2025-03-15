const { DevCommand } = require("./classes/devcommand.js");

class forceclaim extends DevCommand {
    constructor(client){
        super(client, "forceclaim", "claim dinonuggies ignoring cooldown", [], {isSubcommandOf: "dev"});
    }

    async run(interaction){
        const claim = this.client.commands.get("claim");
        await claim.handleSuccessfulClaim(interaction);
    }
}

module.exports = forceclaim;