const { getNuggieStreakMultiplier, getNuggieFlatMultiplier, getNuggieCreditsMultiplier } = require('../utils/ascensionupgrades.js');
const { getMultiplierAmount, getMultiplierChance, getBekiCooldown } = require('../utils/upgrades.js');
const { format } = require('../utils/math.js');
const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const marriageBenefits = require('../utils/marriageBenefits.js');
const { logError } = require('../utils/log');
const fs = require('fs');
const path = require('path');
const { log } = require('util');


const DAY_LENGTH = 24 * 60 * 60 * 1000;
const HOUR_LENGTH = 60 * 60 * 1000;

class Claim extends Command {
    constructor(client) {
        super(client, "claim", "Claim your daily dinonuggies", []);
        this.skins = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config/skin/claim.json'), 'utf8'));
        this.currentSkin = this.skins["christmas"]; // Set skin based on season
    }

    async formatReward(skinKey, amount, multiplier, gold, silver, bronze) {
        const skin = this.currentSkin[skinKey];
        
        // Round percentages to 1 decimal place
        const goldPercentage = (gold * 100).toFixed(1);
        const silverPercentage = (silver * 100).toFixed(1);
        const bronzePercentage = (bronze * 100).toFixed(1);
    
        // Format footer with unique multipliers for each rarity
        const formattedFooter = skin.footer
            .replace(/{gold}/g, goldPercentage)
            .replace(/{silver}/g, silverPercentage)
            .replace(/{bronze}/g, bronzePercentage)
            .replace(/{multiplier_gold}/g, multiplier.gold.toFixed(1))
            .replace(/{multiplier_silver}/g, multiplier.silver.toFixed(1))
            .replace(/{multiplier_bronze}/g, multiplier.bronze.toFixed(1));
    
        return {
            amount: amount,
            title: skin.title.replace("{amount}", amount).replace("{multiplier}", multiplier[skinKey].toFixed(1)),
            imageUrl: skin.imageUrl,
            colour: skin.colour,
            footer: formattedFooter,
            thumbnail: skin.thumbnail
        };
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
        log("claiming dinonuggies");
    
        if (rand < gold) {
            const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.gold);
            return this.formatReward("gold", amount, multiplier, gold, silver, bronze);
        } else if (rand < gold + silver) {
            const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.silver);
            return this.formatReward("silver", amount, multiplier, gold, silver, bronze);
        } else if (rand < gold + silver + bronze) {
            const amount = Math.ceil(await this.getBaseAmount(interaction, streak) * multiplier.bronze);
            return this.formatReward("bronze", amount, multiplier, gold, silver, bronze);
        } else {
            const amount = Math.ceil(await this.getBaseAmount(interaction, streak));
            return this.formatReward("regular", amount, multiplier, gold, silver, bronze);
        }
    }
    

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
