const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class Balance extends Command {
    constructor(client){
        super(client, "balance", "check your mystic credits and bitcoin", []);
    }

    async run(interaction){
        const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
        const bitcoin = await this.client.db.getUserAttr(interaction.user.id, 'bitcoin');
        const lastBoughtAmount = await this.client.db.getUserAttr(interaction.user.id, 'last_bought_amount');
        const lastBoughtPrice = await this.client.db.getUserAttr(interaction.user.id, 'last_bought_price');
        const totalSoldAmount = await this.client.db.getUserAttr(interaction.user.id, 'total_sold_amount');
        const totalSoldPrice = await this.client.db.getUserAttr(interaction.user.id, 'total_sold_price');
        const totalBoughtAmount = await this.client.db.getUserAttr(interaction.user.id, 'total_bought_amount');
        const totalBoughtPrice = await this.client.db.getUserAttr(interaction.user.id, 'total_bought_price');
        console.log(credits);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`You have ${credits} mystic credits and ${bitcoin} bitcoin!`)
            .setDescription(`Bitcoin last bought at ${lastBoughtPrice}/bitcoin (${lastBoughtAmount} bitcoin bought)
Bitcoin total bought: ${totalBoughtAmount} for a total of ${totalBoughtPrice} mystic credits
Bitcoin total sold: ${totalSoldAmount} for a total of ${totalSoldPrice} mystic credits`)
            .setFooter({ text : 'mommy mystic uwu'})
        ]});
    }
}

module.exports = Balance;