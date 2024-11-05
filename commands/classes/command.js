const { logError } = require('../../utils/log');

class Command {
    constructor(client, name, description, options, ephemeral = false, skipDefer = false) {
        this.client = client;
        this.name = name;
        this.description = description;
        this.options = options;
        this.ephemeral = ephemeral;
        this.skipDefer = skipDefer;  // New flag to skip deferReply
    }

    async execute(interaction) {
        try {
            if (this.run !== undefined) {
                // Check if deferReply should be skipped
                if (!this.skipDefer && !interaction.deferred) {
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
                logError(`Command ${this.name} not implemented`);
            }
        } catch (error) {
            // Global error handling logic
            logError(`Error executing command ${this.name}:`, error);

            // Inform the user about the error, if needed
            await interaction.editReply({
                content: "An error occurred while executing the command.\nPlease try again later or modify the inputs.\nIf the issue persists, run /blame command_name and spam ping whoever made the command.",
                ephemeral: true
            });
        }
    }
}

module.exports = { Command };
