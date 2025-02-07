const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class BabyName extends Command {
    constructor(client){
        super(client, "name", "name your baby", [
            {
                name: "other_parent",
                description: "The other parent of the baby",
                type: 6,
                required: true
            },
            {
                name: "name",
                description: "The name of the baby",
                type: 3,
                required: true
            }
        ], {isSubcommandOf: "baby"});

    }

    async run(interaction){
        const name = interaction.options.getString("name");
        const motherId = interaction.user.id;
        const fatherId = interaction.options.getUser("other_parent").id;

        const baby = await this.client.db.getBaby(motherId, fatherId);

        if (!baby){
            await interaction.editReply({
                content: "You don't have a baby to name!"
            });
            return;
        }


        await this.client.db.nameBaby(motherId, fatherId, name);

        await interaction.editReply({
            content: `Baby of <@${motherId}> and <@${fatherId}> is now named ${name}!`
        });
    }
}

module.exports = BabyName;