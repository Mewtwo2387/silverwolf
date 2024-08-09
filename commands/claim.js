const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

const DAY_LENGTH = 24 * 60 * 60 * 1000

class Claim extends Command {
    constructor(client) {
        super(client, "claim", "Claim your daily dinonuggies", [])
    }

    async run(interaction) {
        try {
            const now = new Date();
            const lastClaimed = new Date(await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_last_claimed'));
            const diff = now.getTime() - lastClaimed.getTime();
            const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
            const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

            if(diff < DAY_LENGTH){
                await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                    .setTitle('Dinonuggies already claimed')
                    .setDescription(`You can claim your next nuggie in ${(DAY_LENGTH - diff)/DAY_LENGTH*24} hours`)
                    .setColor('#FF0000')
                ]});
            }else if(diff > 2 * DAY_LENGTH && lastClaimed != null){
                await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                    .setTitle('5 dinonuggies claimed!')
                    .setDescription(`You now have ${dinonuggies + 5} dinonuggies. You broke your streak of ${streak} days.`)
                ]});
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', 5);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            }else{
                await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                    .setTitle(`${5 + streak} dinonuggies claimed!`)
                    .setDescription(`You now have ${dinonuggies + 5 + streak} dinonuggies. You are on a streak of ${streak + 1} days.`)
                ]});
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', 5 + streak);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            }
        } catch (error) {
            console.error('Error claiming dinonuggies:', error);
            await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
        }
    }
}

module.exports = Claim;