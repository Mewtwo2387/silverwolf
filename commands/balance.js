const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

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
        const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
        const dinonuggies_streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
        console.log(credits);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`You have ${format(credits)} mystic credits, ${bitcoin} bitcoin, and ${format(dinonuggies)} dinonuggies`)
            .setDescription(`Bitcoin last bought at ${format(lastBoughtPrice)}/bitcoin (${lastBoughtAmount} bitcoin bought)
Bitcoin total bought: ${totalBoughtAmount} for a total of ${format(totalBoughtPrice)} mystic credits
Bitcoin total sold: ${totalSoldAmount} for a total of ${format(totalSoldPrice)} mystic credits
Dinonuggies claim streak: ${dinonuggies_streak}`)
            .setFooter({ text : 'mommy mystic uwu'})
        ]});
    }
}

module.exports = Balance;