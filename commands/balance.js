const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');
const { log } = require('../utils/log');

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
        const heavenly_nuggies = await this.client.db.getUserAttr(interaction.user.id, 'heavenly_nuggies');
        log(`${interaction.user.username} have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenly_nuggies)} heavenly nuggies`);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`You have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenly_nuggies)} heavenly nuggies`)
            .setDescription(`Bitcoin last bought at ${format(lastBoughtPrice)}/bitcoin (${lastBoughtAmount} bitcoin bought)
Bitcoin total bought: ${totalBoughtAmount} for a total of ${format(totalBoughtPrice)} mystic credits
Bitcoin total sold: ${totalSoldAmount} for a total of ${format(totalSoldPrice)} mystic credits
Dinonuggies claim streak: ${dinonuggies_streak}`)
            .setFooter({ text : 'mommy mystic uwu'})
        ]});
    }
}

module.exports = Balance;