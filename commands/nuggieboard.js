const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

class NuggieBoard extends Command{
    constructor(client){
        super(client, "nuggieboard", "dinonuggie leaderboard", [])
    }

    async run(interaction){
        try {
            const nuggies = await this.client.db.getEveryoneAttr('dinonuggies');
            let result = "1. <@317672630247358466>: Infinity\n"
            for (let i = 0; i < nuggies.length; i++) {
                result += `${i + 2}. <@${nuggies[i].id}>: ${format(nuggies[i].dinonuggies)}\n`
            }
            await interaction.editReply({embeds: [new Discord.EmbedBuilder()
                .setTitle("Dinonuggie Leaderboard")
                .setDescription(result)
            ]});
        }catch(error){
            console.error('Failed to fetch leaderboard:', error);
            await interaction.editReply({ content: 'Failed to retrieve leaderboard', ephemeral: true });
        }
    }
}

module.exports = NuggieBoard;