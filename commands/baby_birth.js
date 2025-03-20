const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const { log } = require('../utils/log.js');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000;

class BabyBirth extends Command {
    constructor(client){
        super(client, "birth", "give birth to your baby", [
            {
                name: "other_parent",
                description: "The other parent of the baby",
                type: 6,
                required: true
            }
        ], { isSubcommandOf: "baby" });
    }

    async run(interaction){
        const userId = interaction.user.id;
        const otherParentId = interaction.options.getUser("other_parent").id;
        const baby = await this.client.db.getBaby(userId, otherParentId);

        log(`baby: ${JSON.stringify(baby)}`);

        if (!baby){
            await interaction.editReply({
                content: "You don't have a baby to give birth to!"
            });
        }

        if (baby.born){
            await interaction.editReply({
                content: "Your baby has already been born!"
            });
            return;
        }

        if (baby.mother_id != userId) {
            await interaction.editReply({
                content: "You are not the mother of this baby!"
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
        
        await this.client.db.bornBaby(userId, otherParentId);

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
