const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class BabyGet extends Command {
    constructor(client){
        super(client, "get", "name your baby", [
            {
                name: "parent1",
                description: "The first parent of the baby",
                type: 6,
                required: true
            },
            {
                name: "parent2",
                description: "The second parent of the baby (default: you)",
                type: 6,
                required: false
            }
        ], {isSubcommandOf: "baby"});
    }

    async run(interaction){
        const parent1 = interaction.options.getUser("parent1");
        const parent2 = interaction.options.getUser("parent2") || interaction.user;

        const baby = await this.client.db.getBaby(parent1.id, parent2.id);

        if (!baby){
            await interaction.editReply({
                content: "404 Baby Not Found"
            });
            return;
        }
        
        const embed = new Discord.EmbedBuilder()
            .setTitle(`Baby of ${parent1.username} and ${parent2.username}`)
            .setDescription(`Name: ${baby.name}\nStatus: ${baby.status}\nCreated: ${baby.created}\nBorn: ${baby.born}`);

        await interaction.editReply({
            embeds: [embed]
        });
    }
}

module.exports = BabyGet;