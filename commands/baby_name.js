const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class BabyName extends Command {
    constructor(client){
        super(client, "name", "name your baby", [
            {
                name: "id",
                description: "The id of the baby",
                type: 4,
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
        const babyId = interaction.options.getInteger("id");

        const baby = await this.client.db.getBabyFromId(babyId);

        if (!baby){
            await interaction.editReply({
                content: "Invalid baby id!"
            });
            return;
        }

        if (baby.mother_id != interaction.user.id && baby.father_id != interaction.user.id){
            await interaction.editReply({
                content: "This is not your baby smh smh"
            });
            return;
        }

        await this.client.db.nameBaby(babyId, name);

        await interaction.editReply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`Baby ${babyId} is now named ${name}!`)
                    .setDescription(`Mother: <@${baby.mother_id}>\nFather: <@${baby.father_id}>\nStatus: ${baby.status}`)
            ]
        });
    }
}

module.exports = BabyName;