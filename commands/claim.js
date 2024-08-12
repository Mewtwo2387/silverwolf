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
                    .setTitle('<:bekis_dinonuggie:1272383551345659905> Dinonuggies already claimed')
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setDescription(`You can claim your next nuggie in ${(DAY_LENGTH - diff)/DAY_LENGTH*24} hours`)
                    .setColor('#FF0000')
                    .setImage('https://media.discordapp.net/attachments/969956051145338991/1272418344284196914/zS4xSOv.png?ex=66bae76d&is=66b995ed&hm=b3b42331d65cab5607f80c728d3a7d96a17cf57ee1f88be94edf90932d3eb81b&=&format=webp&quality=lossless&width=460&height=460')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
            }else if(diff > 2 * DAY_LENGTH && lastClaimed != null){
                await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setTitle('5 dinonuggies claimed!')
                    .setDescription(`You now have ${dinonuggies + 5} dinonuggies. You broke your streak of ${streak} days.`)
                    .setColor('#83F28F')
                    .setImage('https://media.discordapp.net/attachments/969956051145338991/1272417766518816900/8EApw6Y.png?ex=66bae6e3&is=66b99563&hm=80af9cbf28c7cc8d94888fc48184c1e91b2310e5c944d2356cdcd94675c6b764&=&format=webp&quality=lossless&width=460&height=460')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', 5);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            }else{
                await interaction.editReply({ embeds: [ new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setColor('#83F28F')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setTitle(`${5 + streak} dinonuggies claimed!`)
                    .setDescription(`You now have ${dinonuggies + 5 + streak} dinonuggies. You are on a streak of ${streak + 1} days.`)
                    .setImage('https://media.discordapp.net/attachments/969956051145338991/1272417766518816900/8EApw6Y.png?ex=66bae6e3&is=66b99563&hm=80af9cbf28c7cc8d94888fc48184c1e91b2310e5c944d2356cdcd94675c6b764&=&format=webp&quality=lossless&width=460&height=460')
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
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