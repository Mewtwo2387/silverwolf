const { DevCommand } = require("./classes/devcommand.js");

class Execute extends DevCommand {
    constructor(client){
        super(client, "execute", "execute as someone",
            [{
                name: "as",
                description: "the user to execute as",
                type: 6,
                required: true
            },
            {
                name: "command",
                description: "the command to execute",
                type: 3,
                required: true
            }]
        );
    }

    async run(interaction){
        const as = interaction.options.getUser("as");
        const command = interaction.options.getString("command");

        interaction.user = as;
        interaction.member = await interaction.guild.members.fetch(as.id);
        interaction.commandName = command;

        await this.client.processInteraction(interaction);
    }
}

module.exports = Execute;