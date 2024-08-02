class Command {
    constructor(client, name, description, options, ephemeral = false, ignoreDefer = false){
        this.client = client;
        this.name = name;
        this.description = description;
        this.options = options;
        this.ephemeral = ephemeral;
        this.ignoreDefer = ignoreDefer;
    }

    async execute(interaction){
        if (this.run !== undefined) {
            if (!this.ignoreDefer){
                await interaction.deferReply({
                    ephemeral: this.ephemeral
                });
            }
            await this.run(interaction);
        }else{
            interaction.editReply({
                content: "not implemented",
                ephemeral: true
            });
            throw new Error("run() not implemented. (still switching up things)");
        }
    }
}

module.exports = { Command };