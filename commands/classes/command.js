class Command {
    constructor(client, name, description, options, ephemeral = false){
        this.client = client;
        this.name = name;
        this.description = description;
        this.options = options;
        this.ephemeral = ephemeral;
    }

    async execute(interaction){
        try {
            if (this.run !== undefined) {
                if (!interaction.deferred) {
                    await interaction.deferReply({
                        ephemeral: this.ephemeral
                    });
                }
                await this.run(interaction);  // Run the command logic
            } else {
                await interaction.editReply({
                    content: "Not implemented",
                    ephemeral: true
                });
                throw new Error("run() not implemented. (still switching up things)");
            }
        } catch (error) {
            // Global error handling logic
            console.error(`Error executing command ${this.name}:`, error);

            // Inform the user about the error, if needed
            await interaction.editReply({
                content: "An error occurred while executing the command.\nPlease try again later or modify the inputs.\nIf the issue persists, run /blame command_name and spam ping whoever made the command.",
                ephemeral: true
            });
        }
    }
}

module.exports = { Command };