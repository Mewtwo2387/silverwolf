class Command {
    constructor(client, name, description, options){
        this.client = client;
        this.name = name;
        this.description = description;
        this.options = options;
    }

    async execute(interaction){
        if (this.run !== undefined) {
            await this.run(interaction);
        }else{
            interaction.reply({
                content: "not implemented",
                ephemeral: true
            });
            throw new Error("run() not implemented. (still switching up things)");
        }
    }
}

module.exports = { Command };