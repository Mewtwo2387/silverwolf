const { Command } = require('./classes/command.js');
const Discord = require('discord.js');


// We don't talk about the spaghetti code here

class Buy extends Command{
    constructor(client){
        super(client, "buy", "buy upgrades", [
            {
                name: "upgrade",
                description: "The upgrade to buy",
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        const upgrade = interaction.options.getInteger('upgrade');
        if (upgrade == 1){
            const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
            const multiplier_amount_cost = 5000 * multiplier_amount_level;
            const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
            if (credits < multiplier_amount_cost){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle('You dont have enough mystic credits')
                    .setDescription(`You have ${credits} mystic credits, but you need ${multiplier_amount_cost} to buy the upgrade`)
                    .setFooter({ text : 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin'})
                ]});
                return;
            }else{
                const multiplier_amount_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_amount_level');
                const bronze_multiplier = 1.4 + 0.1 * multiplier_amount_level;
                const silver_multiplier = 1.8 + 0.2 * multiplier_amount_level;
                const gold_multiplier = 2.6 + 0.4 * multiplier_amount_level;
                
                await this.client.db.addUserAttr(interaction.user.id, 'credits', -multiplier_amount_cost);
                await this.client.db.addUserAttr(interaction.user.id, 'multiplier_amount_level', 1);

                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Multiplier Amount Upgrade Bought')
                    .setDescription(`Level: ${multiplier_amount_level} -> ${multiplier_amount_level + 1}
Gold Multiplier: ${gold_multiplier.toFixed(2)}x -> ${(gold_multiplier + 0.4).toFixed(2)}x
Silver Multiplier: ${silver_multiplier.toFixed(2)}x -> ${(silver_multiplier + 0.2).toFixed(2)}x
Bronze Multiplier: ${bronze_multiplier.toFixed(2)}x -> ${(bronze_multiplier + 0.1).toFixed(2)}x
Mystic Credits: ${credits} -> ${credits - multiplier_amount_cost}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
            }
        }else if (upgrade == 2){
            const multiplier_rarity_level = await this.client.db.getUserAttr(interaction.user.id, 'multiplier_rarity_level');
            const multiplier_rarity_cost = 5000 * multiplier_rarity_level;
            const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
            if (credits < multiplier_rarity_cost){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle('You dont have enough mystic credits')
                    .setDescription(`You have ${credits} mystic credits, but you need ${multiplier_rarity_cost} to buy the upgrade`)
                    .setFooter({ text : 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin'})
                ]});
                return;
            }else{
                const gold_chance = 0.025 + 0.005 * multiplier_rarity_level;
                const silver_chance = 0.05 + 0.01 * multiplier_rarity_level;
                const bronze_chance = 0.1 + 0.02 * multiplier_rarity_level;
                
                await this.client.db.addUserAttr(interaction.user.id, 'credits', -multiplier_rarity_cost);
                await this.client.db.addUserAttr(interaction.user.id, 'multiplier_rarity_level', 1);

                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Multiplier Rarity Upgrade Bought')
                    .setDescription(`Level: ${multiplier_rarity_level} -> ${multiplier_rarity_level + 1}
Gold Chance: ${(gold_chance * 100).toFixed(2)}% -> ${(gold_chance * 100 + 0.5).toFixed(2)}%
Silver Chance: ${(silver_chance * 100).toFixed(2)}% -> ${(silver_chance * 100 + 1).toFixed(2)}%
Bronze Chance: ${(bronze_chance * 100).toFixed(2)}% -> ${(bronze_chance * 100 + 2).toFixed(2)}%
Mystic Credits: ${credits} -> ${credits - multiplier_rarity_cost}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
            }
        }else if (upgrade == 3){
            const beki_level = await this.client.db.getUserAttr(interaction.user.id, 'beki_level');
            const beki_cost = 5000 * beki_level;
            const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
            if (credits < beki_cost){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle('You dont have enough mystic credits')
                    .setDescription(`You have ${credits} mystic credits, but you need ${beki_cost} to buy the upgrade`)
                    .setFooter({ text : 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin'})
                ]});
                return;
            }else{
                const cooldown = 24 * Math.pow(0.95, beki_level - 1);
                
                await this.client.db.addUserAttr(interaction.user.id, 'credits', -beki_cost);
                await this.client.db.addUserAttr(interaction.user.id, 'beki_level', 1);

                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle('Beki Upgrade Bought')
                    .setDescription(`Level: ${beki_level} -> ${beki_level + 1}
Cooldown: ${cooldown.toFixed(2)}hrs -> ${(cooldown * 0.95).toFixed(2)}hrs
Mystic Credits: ${credits} -> ${credits - beki_cost}`)
                    .setFooter({ text : 'dinonuggie'})
                ]});
            }
        }else{
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle('Invalid upgrade')
                .setFooter({ text : 'dinonuggie'})
            ]});
        }
    }
}

module.exports = Buy;