const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const { log } = require('../utils/log.js');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000;

class BabyBirth extends Command {
    constructor(client){
        super(client, "birth", "give birth to your baby", [
            {
                name: "id",
                description: "The id of the baby",
                type: 4,
                required: true
            }
        ], { isSubcommandOf: "baby" });
    }

    async run(interaction){
        const userId = interaction.user.id;
        const babyId = interaction.options.getInteger("id");
        const baby = await this.client.db.getBabyFromId(babyId);

        if (!baby){
            await interaction.editReply({
                content: "Invalid baby id!"
            });
            return;
        }

        if (baby.mother_id != userId){
            if (baby.father_id == userId){
                await interaction.editReply({
                    content: "You are not the mother of this baby!"
                });
                return;
            } else {
                await interaction.editReply({
                    content: "This is not your baby smh smh"
                });
                return;
            }
        }

        if (baby.status != "unborn"){
            await interaction.editReply({
                content: "Your baby is already born!"
            });
            return;
        }

        const created = new Date(baby.created);
        const now = new Date();

        const diffTime = Math.abs(now - created);

        if (diffTime < PREGNANCY_DURATION){
            await interaction.editReply({
                content: "Your baby is not ready to be born yet!"
            });
            return;
        }
        
        await this.client.db.bornBaby(userId, babyId);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Green")
                    .setTitle(`Congratulations!`)
                    .setDescription(`**${baby.name}** has been born!`)
            ]
        });
    }
}


module.exports = BabyBirth;
