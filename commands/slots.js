const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

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
        const credits = await this.client.db.getCredits(interaction.user.id);
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

        var winnings = 0

        const lines = [[0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2], [0,1,2,2,2], [2,1,0,0,0], [0,0,0,1,2], [2,2,2,1,0]]

        for (var i = 0; i < lines.length; i++) {
            const line = lines[i];
            if(results[line[0]][0].value == results[line[1]][1].value && results[line[1]][1].value == results[line[2]][2].value && results[line[2]][2].value == results[line[3]][3].value && results[line[3]][3].value == results[line[4]][4].value){
                winnings += results[line[0]][0].value * amount * 25;
            }else if(results[line[0]][0].value == results[line[1]][1].value && results[line[1]][1].value == results[line[2]][2].value && results[line[2]][2].value == results[line[3]][3].value){
                winnings += results[line[0]][0].value * amount * 5;
            }else if(results[line[0]][0].value == results[line[1]][1].value && results[line[1]][1].value == results[line[2]][2].value){
                winnings += results[line[1]][1].value * amount;
            }
        }

        await this.client.db.addCredits(interaction.user.id, winnings - amount);

        if(amount >= 0){
            if (winnings == 0){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You bet ${amount} mystic credits and didn't win anything!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }else{
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`You bet ${amount} mystic credits and won ${winnings} mystic credits!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }
        }else{
            if (winnings == 0){
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You bet ${amount} mystic credits of debt and got rid of all the debt!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }else{
                await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                    .setColor('#00AA00')
                    .setTitle(`You bet ${amount} mystic credits of debt and won ${winnings} mystic credits of debt!`)
                    .setDescription(`${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`)
                ]});
            }
        }
    }
}

module.exports = Slots;