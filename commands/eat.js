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
            await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', -1);
            if(Math.random() < 0.2){
                const earned = 2000 + Math.floor(Math.random() * 1000);
                await interaction.editReply("You found a hidden mystichunterzium nugget in the dinonuggie! You earned " + earned + " mystic credits.");
                await this.client.db.updateUserAttr(interaction.user.id, 'credits', earned);
                return;
            }
            if(Math.random() < 0.1){
                await interaction.editReply("You choked on the dinonuggie and died.");
                return;
            }
            await interaction.editReply("nom nom nom");
            return;
        }
    }
}

module.exports = Eat;