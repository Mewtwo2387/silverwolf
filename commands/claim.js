const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

const DAY_LENGTH = 24 * 60 * 60 * 1000;

class Claim extends Command {
    constructor(client) {
        super(client, "claim", "Claim your daily dinonuggies", []);
    }

    async run(interaction) {
        try {
            const now = new Date();
            const lastClaimed = new Date(await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_last_claimed'));
            const diff = now.getTime() - lastClaimed.getTime();
            const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
            const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

            // Function to determine the multiplier based on probabilities
            const getMultiplier = () => {
                const rand = Math.random(); // Get a random number between 0 and 1
                if (rand < 0.05) {
                    return {
                        multiplier: 10,
                        title: "Congratulations! You've claimed a golden dinonuggie!! 10x earned this claim!",
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272801662121283614/AMuYswc.png?ex=66bc4c6b&is=66bafaeb&hm=1d284683c81389bf481ca100eb631a3b4d85ff51c86e22e7032f5cab30e73763&=&format=webp&quality=lossless&width=806&height=1169",
                        colour: '#FFD700'
                    };
                } else if (rand < 0.20) {
                    return {
                        multiplier: 5,
                        title: "Congratulations! You've claimed a silver dinonuggie!! 5x earned this claim!",
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272804142871609445/r0LVjIF.png?ex=66bc4ebb&is=66bafd3b&hm=75fcdacc2e0e138e0ad0640d7328607fa8a692c626398bf19d8ce4631b4a63ef&=&format=webp&quality=lossless&width=433&height=629",
                        colour: '#C0C0C0'
                    };
                } else if (rand < 0.50) {
                    return {
                        multiplier: 2,
                        title: "Congratulations! You've claimed a bronze dinonuggie!! 2x earned this claim!",
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272919852507463773/OXjd97e.png?ex=66bcba7e&is=66bb68fe&hm=34ef60370f5d26896aa8feca56846920228c78299144e9b5deb5d172522df56d&=&format=webp&quality=lossless&width=896&height=1169",
                        colour: '#CD7F32'
                    };
                } else {
                    return {
                        multiplier: 1,
                        title: `${5 + streak} dinonuggies claimed!`,
                        imageUrl: "https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png",
                        colour: '#83F28F'
                    };
                }
            };

            if (diff < DAY_LENGTH) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setTitle('Beki is currently cooking the next batch of dinonuggies please wait')
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setDescription(`You can claim your next nuggie in ${(DAY_LENGTH - diff) / DAY_LENGTH * 24} hours`)
                    .setColor('#FF0000')
                    .setImage('https://cdn.discordapp.com/attachments/1070612017058160731/1272915299615768687/vEHw5Aq.gif?ex=66bcb641&is=66bb64c1&hm=7e672767e921c7a805bd2d0d32e22b695d9ae2f6d34c2c7658c5ebb37ff78ad6&')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
            } else if (diff > 2 * DAY_LENGTH && lastClaimed != null) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setTitle('5 dinonuggies claimed!')
                    .setDescription(`You now have ${dinonuggies + 5} dinonuggies. You broke your streak of ${streak} days.`)
                    .setColor('#83F28F')
                    .setImage('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', 5);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            } else {
                const { multiplier, title, imageUrl, colour } = getMultiplier();
                const claimedNuggies = (5 + streak) * multiplier;

                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setColor(colour)
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setTitle(title)
                    .setDescription(`You now have ${dinonuggies + claimedNuggies} dinonuggies. You are on a streak of ${streak + 1} days.`)
                    .setImage(imageUrl)
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies', claimedNuggies);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.updateUserAttr(interaction.user.id, 'dinonuggies_claim_streak', streak + 1);
            }
        } catch (error) {
            console.error('Error claiming dinonuggies:', error);
            await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
        }
    }
}

module.exports = Claim;
