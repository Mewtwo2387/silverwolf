const { Command } = require("./classes/command.js");

class Eat extends Command {
    constructor(client){
        super(client, "eat", "eat a dinonuggie", []);
    }

    async run(interaction){
        const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

        if(dinonuggies < 1){
            await interaction.editReply("smh you have nothing to eat");
            return;
        }else{
            await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', -1);
            const rand = Math.random();
            if(rand < 0.2){ // 20%
                const earned = 2000 + Math.floor(Math.random() * 1000);
                await interaction.editReply("You found a hidden mystichunterzium nugget in the dinonuggie! You earned " + earned + " mystic credits.");
                await this.client.db.addUserAttr(interaction.user.id, 'credits', earned);
                return;
            }else if(rand < 0.25){ // 5%
                const earned = 5000 + Math.floor(Math.random() * 2000);
                await interaction.editReply("You found a huge mystichunterzium nugget in the dinonuggie! You earned " + earned + " mystic credits.");
                await this.client.db.addUserAttr(interaction.user.id, 'credits', earned);
                return;
            }else if (rand < 0.35){ // 10%
                await interaction.editReply("You choked on the dinonuggie and died.");
                return;
            }else if (rand < 0.45){ // 10%
                await interaction.editReply("You found 2 dinonuggies in the dinonuggie! I don't know how that works it just does.");
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', 2);
                return;
            }else if (rand < 0.48){ // 3%
                await interaction.editReply("You found 5 dinonuggies in the dinonuggie! Uhmmm what?");
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', 5);
                return;
            }
            // 52%
            await interaction.editReply("nom nom nom");
            return;
        }
    }
}

module.exports = Eat;