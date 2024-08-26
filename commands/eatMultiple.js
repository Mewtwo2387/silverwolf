const { Command } = require("./classes/command.js");
const { format } = require("../utils/math.js");
const Discord = require('discord.js');

class EatMultiple extends Command {
    constructor(client){
        super(client, "eatmultiple", "eat dinonuggies until you choke (and lose the remaining ones)", [
            {
                name: 'amount',
                description: 'the amount of dinonuggies to eat',
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        var amount = interaction.options.getInteger('amount');
        const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

        if(dinonuggies < amount){
            await interaction.editReply("smh you don't have enough dinonuggies to eat");
            return;
        }else{
            await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', -amount);
            var message = '';
            var totalEarned = 0;
            var totalNuggiesEarned = 0;
            while (amount > 0){
                amount--;
                const rand = Math.random();
                if(rand < 0.2){ // 20%
                    const earned = 2000 + Math.floor(Math.random() * 1000);
                    message += "- You found a hidden mystichunterzium nugget in the dinonuggie! You earned " + format(earned) + " mystic credits.\n";
                    totalEarned += earned;
                    continue;
                }else if(rand < 0.25){ // 5%
                    const earned = 5000 + Math.floor(Math.random() * 2000);
                    message += "- You found a huge mystichunterzium nugget in the dinonuggie! You earned " + format(earned) + " mystic credits.\n";
                    totalEarned += earned;
                    continue;
                }else if (rand < 0.35){ // 10%
                    message += "- You choked on the dinonuggie and died.\n";
                    break;
                }else if (rand < 0.45){ // 10%
                    message += "- You found 2 dinonuggies in the dinonuggie! I don't know how that works it just does.\n";
                    totalNuggiesEarned += 2;
                    continue;
                }else if (rand < 0.48){ // 3%
                    message += "- You found 5 dinonuggies in the dinonuggie! Uhmmm what?\n";
                    totalNuggiesEarned += 5;
                    continue;
                }
                message += "- nom nom nom\n";
            }

            message += "\n"

            if (amount > 0){
                message += "You lost the remaining " + amount + " dinonuggies.\n";
            }

            if (totalEarned > 0){
                message += "You earned a total of " + format(totalEarned) + " mystic credits.\n";
                await this.client.db.addUserAttr(interaction.user.id, 'credits', totalEarned);
            }

            if (totalNuggiesEarned > 0){
                message += "You earned a total of " + totalNuggiesEarned + " dinonuggies.\n";
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', totalNuggiesEarned);
            }

            await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`You tried eating ${interaction.options.getInteger('amount')} dinonuggies`)
                .setDescription(message)
            ]});
        }
    }
}

module.exports = EatMultiple;