const { getNuggieStreakMultiplier, getNuggieFlatMultiplier, getNuggieCreditsMultiplier } = require('../utils/ascensionupgrades.js');
const { getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades.js');
const { format } = require('../utils/math.js');
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const marriageBenefits = require('../utils/marriageBenefits.js');
const { logError } = require('../utils/log');

const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

class Claim extends Command {
    constructor(client) {
        super(client, "claim", "Claim your daily dinonuggies", []);
    }

    async getBaseAmount(interaction, streak) {
        const nuggie_flat_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_flat_multiplier_level');
        const nuggie_streak_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_streak_multiplier_level');
        const marriage_benefits = await marriageBenefits(this.client, interaction.user.id);
        const nuggie_credits_multiplier_level = await this.client.db.getUserAttr(interaction.user.id, 'nuggie_credits_multiplier_level');
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        const log2_credits = credits > 1 ? Math.log2(credits) : 0;
        return (5 + streak) * (1 + streak * getNuggieStreakMultiplier(nuggie_streak_multiplier_level)) * getNuggieFlatMultiplier(nuggie_flat_multiplier_level) * marriage_benefits * (1 + log2_credits * getNuggieCreditsMultiplier(nuggie_credits_multiplier_level));
    }

    async getAmount(interaction, streak) {
        const rand = Math.random();
        const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
        const multiplier_rarity_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
        const multiplier = getMultiplierAmount(multiplier_amount_level);
        const { gold, silver, bronze } = getMultiplierChance(multiplier_rarity_level);
//original
        // if (rand < gold) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.gold);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a golden dinonuggie!! ${format(multiplier.gold, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272801662121283614/AMuYswc.png?ex=66bc4c6b&is=66bafaeb&hm=1d284683c81389bf481ca100eb631a3b4d85ff51c86e22e7032f5cab30e73763&=&format=webp&quality=lossless&width=806&height=1169",
        //         colour: '#FFD700',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
        //         thumbnail: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png'
        //     };
        // } else if (rand < gold + silver) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.silver);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a silver dinonuggie!! ${format(multiplier.silver, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272804142871609445/r0LVjIF.png?ex=66bc4ebb&is=66bafd3b&hm=75fcdacc2e0e138e0ad0640d7328607fa8a692c626398bf19d8ce4631b4a63ef&=&format=webp&quality=lossless&width=433&height=629",
        //         colour: '#C0C0C0',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
        //         thumbnail: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png'
        //     };
        // } else if (rand < gold + silver + bronze) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.bronze);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a bronze dinonuggie!! ${format(multiplier.bronze, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1070612017058160731/1272919852507463773/OXjd97e.png?ex=66bcba7e&is=66bb68fe&hm=34ef60370f5d26896aa8feca56846920228c78299144e9b5deb5d172522df56d&=&format=webp&quality=lossless&width=896&height=1169",
        //         colour: '#CD7F32',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
        //         thumbnail: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png'
        //     };
        // } else {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak));
        //     return {
        //         amount: amount,
        //         title: `${format(amount)} dinonuggies claimed!`,
        //         imageUrl: "https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa",
        //         colour: '#83F28F',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
        //         thumbnail: 'https://media.forgecdn.net/avatars/thumbnails/375/327/256/256/637550156004612442.png'
        //     };
        // }

// halloween update
        // if (rand < gold) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.gold);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a golden gummynuggie!! ${format(multiplier.gold, true)}x earned this claim for a total of ${format(amount)} gummynuggie!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1168356994453885059/1301101446959468594/Xl7UV4y.png?ex=672340a6&is=6721ef26&hm=3c8f62666d10cfbf3a79d18901a390c42483800864a04a08c51417215a7775aa&=&format=webp&quality=lossless&width=876&height=1169",
        //         colour: '#FFD700',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`
        //     };
        // } else if (rand < gold + silver) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.silver);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a silver gummynuggie!! ${format(multiplier.silver, true)}x earned this claim for a total of ${format(amount)} gummynuggies!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1168356994453885059/1301101446380523571/tRvkJDb.png?ex=672340a6&is=6721ef26&hm=afdbe8ce45ead0124f6492d82ba689c6d281617fc9a8fe91ed2e523e6439760d&=&format=webp&quality=lossless&width=876&height=1169",
        //         colour: '#C0C0C0',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`
        //     };
        // } else if (rand < gold + silver + bronze) {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.bronze);
        //     return {
        //         amount: amount,
        //         title: `Congratulations! You've claimed a bronze gummynuggie!! ${format(multiplier.bronze, true)}x earned this claim for a total of ${format(amount)} gummynuggies!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1168356994453885059/1301101447584157696/Fmi8wTB.png?ex=672340a6&is=6721ef26&hm=4ff5a5cb7d4b437d9f942117d2c5987d6d87b0e449a0d46c38a70ec3a7879724&=&format=webp&quality=lossless&width=876&height=1169",
        //         colour: '#CD7F32',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`
        //     };
        // } else {
        //     const amount = Math.ceil(await this.getBaseAmount(interaction, streak));
        //     return {
        //         amount: amount,
        //         title: `${format(amount)} gummynuggies claimed!`,
        //         imageUrl: "https://media.discordapp.net/attachments/1168356994453885059/1301102084002943017/jF8vRKZ.png?ex=6723413e&is=6721efbe&hm=ef1c378986d8ba2b5aa6f04f725392621f07147e6c012fa80fa9d7d2b3aa1e3e&=&format=webp&quality=lossless&width=592&height=242",
        //         colour: '#83F28F',
        //         footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`
        //     };
        // }

// christmas update
    if (rand < gold) {
        const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.gold);
        return {
            amount: amount,
            title: `Congratulations! You've claimed a golden dinonuggie!! ${format(multiplier.gold, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
            imageUrl: "https://drive.google.com/thumbnail?id=1U5oXdCW6LMjLgVxNWN-i4kDH_wow3yPp",
            colour: '#FFD700',
            footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
            thumbnail: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa'
        };
    } else if (rand < gold + silver) {
        const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.silver);
        return {
            amount: amount,
            title: `Congratulations! You've claimed a silver dinonuggie!! ${format(multiplier.silver, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
            imageUrl: "https://drive.google.com/thumbnail?id=1Q29dJ1ST1GMxmeM98jub4RKIpm-bZC1v",
            colour: '#C0C0C0',
            footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
            thumbnail: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa'
        };
    } else if (rand < gold + silver + bronze) {
        const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.bronze);
        return {
            amount: amount,
            title: `Congratulations! You've claimed a bronze dinonuggie!! ${format(multiplier.bronze, true)}x earned this claim for a total of ${format(amount)} dinonuggies!`,
            imageUrl: "https://drive.google.com/thumbnail?id=1oLvRzxrs7b9Z97BVOacNbNCrodr68Fll",
            colour: '#CD7F32',
            footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
            thumbnail: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa'
        };
    } else {
        const amount = Math.ceil(await this.getBaseAmount(interaction, streak));
        return {
            amount: amount,
            title: `${format(amount)} dinonuggies claimed!`,
            imageUrl: "https://drive.google.com/thumbnail?id=1_RPbZ680d8QFBv8oZMCwom6RrlgSUYBR",
            colour: '#83F28F',
            footer: `Gold: ${format(gold * 100, true)}% for ${format(multiplier.gold, true)}x | Silver: ${format(silver * 100, true)}% for ${format(multiplier.silver, true)}x | Bronze: ${format(bronze * 100, true)}% for ${format(multiplier.bronze, true)}x. Check upgrades with /upgrades`,
            thumbnail: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa'
        };
    }       
    };

    async run(interaction) {
        try {
            const now = new Date();
            const lastClaimedInt = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_last_claimed')

            const lastClaimed = lastClaimedInt ? new Date(lastClaimedInt) : null;
            const diff = lastClaimed ? now - lastClaimed : DAY_LENGTH;

            const streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
            const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
            const beki_level = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');

            const cooldown = getBekiCooldown(beki_level);

            if (diff < cooldown * HOUR_LENGTH) {
                const responses = [
                    {
                        title: 'Beki is currently cooking the next batch of dinonuggies please wait',
                        gifUrl: 'https://media1.tenor.com/m/i6sOwD66MAEAAAAC/frieren-frieren-beyond-journey%27s-end.gif'
                    },
                    {
                        title: 'Beki is having a little bit of an issue. Please hold',
                        gifUrl: 'https://media1.tenor.com/m/h6XlgMwYBnkAAAAd/frieren-sousou-no-frieren.gif'
                    },
                    {
                        title : 'Ah shit i forgottt, hang on a momentt-',
                        gifUrl : 'https://media1.tenor.com/m/TYW-RNzp6hEAAAAC/sousou-no-frieren-frieren-beyond-journey.gif'
                    },
                    {
                        title : 'uhhh what is beki doing ?',
                        gifUrl: 'https://media.tenor.com/RYGLfSXNIRIAAAAi/frieren.gif'
                    },
                    {
                        title : 'Beki fucking dies of exhaustion',
                        gifUrl : 'https://media1.tenor.com/m/kU_EwdsrkLkAAAAC/frieren-dies-cold.gif'
                    }
                ];
            
                const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
            
                // Build and send the embed
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle(selectedResponse.title)
                            .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
                            .setDescription(`You can claim your next nuggie in ${cooldown - diff / HOUR_LENGTH} hours.`)
                            .setColor('#FF0000')
                            .setImage(selectedResponse.gifUrl)
                            .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                            .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                    ]
                });
            } else if (diff > 2 * DAY_LENGTH) {
                const amount = await this.getBaseAmount(interaction, 0);
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
                    .setTitle(`${format(amount)} dinonuggies claimed!`)
                    .setDescription(`You now have ${format(dinonuggies + amount)} dinonuggies. You broke your streak of ${streak} days.`)
                    .setColor('#83F28F')
                    .setImage('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                    .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                ]});
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', amount);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            } else {
                const { amount, title, imageUrl, colour, footer, thumbnail } = await this.getAmount(interaction, streak);
                await interaction.editReply({ embeds: [new Discord.EmbedBuilder()
                    .setThumbnail(thumbnail)
                    .setColor(colour)
                    .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                    .setTitle(title)
                    .setDescription(`You now have ${format(dinonuggies + amount)} dinonuggies. You are on a streak of ${streak + 1} days.`)
                    .setImage(imageUrl)
                    .setFooter({ text: `dinonuggie | ${footer}`, iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
                ]});
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', amount);
                await this.client.db.setUserAttr(interaction.user.id, 'dinonuggies_last_claimed', now);
                await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies_claim_streak', 1);
            }
        } catch (error) {
            logError('Error claiming dinonuggies:', error);
            await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
        }
    }
}

module.exports = Claim;
