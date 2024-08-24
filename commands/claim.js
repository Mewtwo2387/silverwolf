const { format } = require('../utils/math.js');
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

class Claim extends Command {
    constructor(client) {
        super(client, "claim", "Claim your daily dinonuggies", []);
    }

    async run(interaction) {
        try {
            const now = new Date();
            const lastClaimedInt = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_last_claimed')
            var lastClaimed, diff;
            if(lastClaimedInt == null){
                lastClaimed = null
                diff = DAY_LENGTH;
            }else{
                lastClaimed = new Date(lastClaimedInt);
                diff = now.getTime() - lastClaimed.getTime();
            }
            const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
            const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
            const beki_level = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');
            const cooldown = 24 * Math.pow(0.95, beki_level - 1)

            // Function to determine the multiplier based on probabilities
            const getMultiplier = async () => {
                const rand = Math.random(); // Get a random number between 0 and 1
                const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
                const multiplier_rarity_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
                const bronze_multiplier = 1.4 + 0.1 * multiplier_amount_level;
                const silver_multiplier = 1.8 + 0.2 * multiplier_amount_level;
                const gold_multiplier = 2.6 + 0.4 * multiplier_amount_level;
                const gold_chance = 0.025 + 0.005 * multiplier_rarity_level;
                const silver_chance = 0.05 + 0.01 * multiplier_rarity_level;
                const bronze_chance = 0.1 + 0.02 * multiplier_rarity_level;
                if (rand < gold_chance) {
                    return {
                        multiplier: gold_multiplier,
                        title: `Congratulations! You've claimed a golden dinonuggie!! ${format(gold_multiplier, true)}x earned this claim for a total of ${format(Math.ceil((5 + streak) * gold_multiplier))} dinonuggies!`,
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272801662121283614/AMuYswc.png?ex=66bc4c6b&is=66bafaeb&hm=1d284683c81389bf481ca100eb631a3b4d85ff51c86e22e7032f5cab30e73763&=&format=webp&quality=lossless&width=806&height=1169",
                        colour: '#FFD700',
                        footer: `Gold: ${format(gold_chance * 100, true)}% for ${format(gold_multiplier, true)}x | Silver: ${format(silver_chance * 100, true)}% for ${format(silver_multiplier, true)}x | Bronze: ${format(bronze_chance * 100, true)}% for ${format(bronze_multiplier, true)}x. Check upgrades with /upgrades`
                    };
                } else if (rand < gold_chance + silver_chance) {
                    return {
                        multiplier: silver_multiplier,
                        title: `Congratulations! You've claimed a silver dinonuggie!! ${format(silver_multiplier, true)}x earned this claim for a total of ${format(Math.ceil((5 + streak) * silver_multiplier))} dinonuggies!`,
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272804142871609445/r0LVjIF.png?ex=66bc4ebb&is=66bafd3b&hm=75fcdacc2e0e138e0ad0640d7328607fa8a692c626398bf19d8ce4631b4a63ef&=&format=webp&quality=lossless&width=433&height=629",
                        colour: '#C0C0C0',
                        footer: `Gold: ${format(gold_chance * 100, true)}% for ${format(gold_multiplier, true)}x | Silver: ${format(silver_chance * 100, true)}% for ${format(silver_multiplier, true)}x | Bronze: ${format(bronze_chance * 100, true)}% for ${format(bronze_multiplier, true)}x. Check upgrades with /upgrades`
                    };
                } else if (rand < gold_chance + silver_chance + bronze_chance) {    
                    return {
                        multiplier: bronze_multiplier,
                        title: `Congratulations! You've claimed a bronze dinonuggie!! ${format(bronze_multiplier, true)}x earned this claim for a total of ${format(Math.ceil((5 + streak) * bronze_multiplier))} dinonuggies!`,
                        imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272919852507463773/OXjd97e.png?ex=66bcba7e&is=66bb68fe&hm=34ef60370f5d26896aa8feca56846920228c78299144e9b5deb5d172522df56d&=&format=webp&quality=lossless&width=896&height=1169",
                        colour: '#CD7F32',
                        footer: `Gold: ${format(gold_chance * 100, true)}% for ${format(gold_multiplier, true)}x | Silver: ${format(silver_chance * 100, true)}% for ${format(silver_multiplier, true)}x | Bronze: ${format(bronze_chance * 100, true)}% for ${format(bronze_multiplier, true)}x. Check upgrades with /upgrades`
                    };
                } else {
                    return {
                        multiplier: 1,
                        title: `${5 + streak} dinonuggies claimed!`,
                        imageUrl: "https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png",
                        colour: '#83F28F',
                        footer: `Gold: ${format(gold_chance * 100, true)}% for ${format(gold_multiplier, true)}x | Silver: ${format(silver_chance * 100, true)}% for ${format(silver_multiplier, true)}x | Bronze: ${format(bronze_chance * 100, true)}% for ${format(bronze_multiplier, true)}x. Check upgrades with /upgrades`
                    };
                }
            };

            if (diff < cooldown * HOUR_LENGTH) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setTitle('Beki is currently cooking the next batch of dinonuggies please wait')
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setDescription(`You can claim your next nuggie in ${cooldown - diff / HOUR_LENGTH} hours.`)
                    .setColor('#FF0000')
                    .setImage('https://cdn.discordapp.com/attachments/1070612017058160731/1272915299615768687/vEHw5Aq.gif?ex=66bcb641&is=66bb64c1&hm=7e672767e921c7a805bd2d0d32e22b695d9ae2f6d34c2c7658c5ebb37ff78ad6&')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
            } else if (diff > 2 * DAY_LENGTH) {
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setTitle('5 dinonuggies claimed!')
                    .setDescription(`You now have ${format(dinonuggies + 5)} dinonuggies. You broke your streak of ${streak} days.`)
                    .setColor('#83F28F')
                    .setImage('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', 5);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            } else {
                const { multiplier, title, imageUrl, colour, footer } = await getMultiplier();
                const claimedNuggies = Math.ceil((5 + streak) * multiplier)

                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail('https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png')
                    .setColor(colour)
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                    .setTitle(title)
                    .setDescription(`You now have ${format(dinonuggies + claimedNuggies)} dinonuggies. You are on a streak of ${streak + 1} days.`)
                    .setImage(imageUrl)
                    .setFooter({ text: `dinonuggie | ${footer}`, iconURL: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png' })
                ]});
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', claimedNuggies);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            }
        } catch (error) {
            console.error('Error claiming dinonuggies:', error);
            await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
        }
    }
}

module.exports = Claim;
