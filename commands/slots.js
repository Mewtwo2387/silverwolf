const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const marriageBenefits = require('../utils/marriageBenefits.js');

class Slots extends Command {
    constructor(client){
        super(client, "slots", "lose all your mystic credits", [
            {
                name: 'amount',
                description: 'the amount of mystic credits to bet',
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        const amount = interaction.options.getInteger('amount');
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        if(amount > credits){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`You're too poor to bet that much smh`)
            ]});
            return;
        }

        const smugs = [
            {emote: "<:1yanfeismug:1136925353651228775>", value: 10},
            {emote: "<:1silverwolfsmug1:1212343617113559051>", value: 8},
            {emote: "<:1keqingsmug:1139794287337414766>", value: 6},
            {emote: "<:4meltsmug:1141012813997932555>", value: 4},
            {emote: "<:0mysticsmuguwu:1181410473695002634>", value: 2},
            {emote: "<:1yanfeismug3:1181812629451317298>", value: 2},
            {emote: "<:1gumsiefnay:1140883820795666463>", value: 2},
        ]

        var results = [[], [], []];

        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 5; j++) {
                results[i].push(smugs[Math.floor(Math.random() * smugs.length)]);
            }
        }

        var multi = 0

        const lines = [[0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2], [0,1,2,2,2], [2,1,0,0,0], [0,0,0,1,2], [2,2,2,1,0]]

        for (var i = 0; i < lines.length; i++) {
            const line = lines[i];
            if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote && results[line[2]][2].emote == results[line[3]][3].emote && results[line[3]][3].emote == results[line[4]][4].emote){
                multi += results[line[0]][0].value * 25;
            }else if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote && results[line[2]][2].emote == results[line[3]][3].emote){
                multi += results[line[0]][0].value * 5;
            }else if(results[line[0]][0].emote == results[line[1]][1].emote && results[line[1]][1].emote == results[line[2]][2].emote){
                multi += results[line[1]][1].value;
            }
        }

        if(amount >= 0){
            multi *= await marriageBenefits(this.client, interaction.user.id);
            const winnings = multi * amount;
            await this.client.db.addUserAttr(interaction.user.id, 'slots_times_played', 1);
            await this.client.db.addUserAttr(interaction.user.id, 'slots_amount_gambled', amount);
            await this.client.db.addUserAttr(interaction.user.id, 'slots_times_won', multi > 0 ? 1 : 0);
            await this.client.db.addUserAttr(interaction.user.id, 'slots_amount_won', winnings);
            await this.client.db.addUserAttr(interaction.user.id, 'slots_relative_won', multi);
            await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings - amount);
            if (multi == 0){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You bet ${format(amount)} mystic credits and didn't win anything!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }else{
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`You bet ${format(amount)} mystic credits and won ${format(winnings)} mystic credits!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }
        }else{
            // await this.client.db.addUserAttr(interaction.user.id, 'credits', winnings - amount);
            // if (winnings == 0){
            //     await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            //         .setColor('#AA0000')
            //         .setTitle(`You bet ${amount} mystic credits of debt and got rid of all the debt!`)
            //         .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
            //     ]});
            // }else{
            //     await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            //         .setColor('#00AA00')
            //         .setTitle(`You bet ${amount} mystic credits of debt and won ${winnings} mystic credits of debt!`)
            //         .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
            //     ]});
            // }
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`Betting debt is temporarily disabled`)
            ]});
        }
    }
}

module.exports = Slots;