const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

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
        let bornStatus = "";
        if (baby.status == "unborn"){
            const created = new Date(baby.created);
            const now = new Date();

            const diffTime = Math.abs(now - created);
            if (diffTime > PREGNANCY_DURATION){
              bornStatus = "Can give birth now! Use /baby birth";
            } else {
              bornStatus = `Can give birth in ${format(Math.ceil((PREGNANCY_DURATION - diffTime) / (1000 * 60 * 60 * 24)), true)} days`;
            }
        } else {
          bornStatus = `Born: ${baby.born}`;
        }
        const embed = new Discord.EmbedBuilder()
            .setTitle(`Baby of ${parent1.username} and ${parent2.username}`)
            .setDescription(`Name: ${baby.name}\nStatus: ${baby.status}\nCreated: ${baby.created}\n${bornStatus}`);

        await interaction.editReply({
            embeds: [embed]
        });
    }
}

module.exports = BabyGet;