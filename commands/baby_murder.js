const { Command } = require('./classes/command.js');
const { format } = require('../utils/math.js');

class BabyMurder extends Command {
    constructor(client){
        super(client, "murder", "kill a baby (omba told me to add this)",
            [
                {
                    name: "id",
                    description: "The id of the baby",
                    type: 4,
                }
            ],
            {
                isSubcommandOf: "baby"
            }
        );
    }

    async run(interaction){
        const babyId = interaction.options.getInteger("id");
        const baby = await this.client.db.getBabyFromId(babyId);

        if (!baby){
            await interaction.editReply({
                content: "Invalid baby id!"
            });
        }

        if (baby.status !== "born"){
            await interaction.editReply({
                content: "You can't murder an unborn baby!"
            });
            return;
        }

        if (Math.random() < 0.5){
            await this.client.db.updateBabyStatus(babyId, "dead");
            await interaction.editReply({
              content: `You killed ${baby.name}!
<@${baby.mother_id}> <@${baby.father_id}> look at this murderer`
            });
        } else {
            const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, "dinonuggies");
            await this.client.db.setUserAttr(interaction.user.id, "dinonuggies", 0)
            const credits = await this.client.db.getUserAttr(interaction.user.id, "credits");
            await this.client.db.setUserAttr(interaction.user.id, "credits", 0);
            await interaction.editReply({
                content: `You tried killing ${baby.name}, but ${baby.name} killed you instead! You lost ${format(dinonuggies)} dinonuggies and ${format(credits)} credits!
<@${baby.mother_id}> <@${baby.father_id}> look at this guy trying to murder your baby`
            });
        }
    }
}

module.exports = BabyMurder;