const { Command } = require('./classes/command.js');
const Discord = require('discord.js');

class Balance extends Command {
    constructor(client){
        super(client, "credits", "check your mystic credits", []);
    }

    async run(interaction){
        const credits = await this.client.db.getCredits(interaction.user.id);
        console.log(credits);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`You have ${credits} mystic credits!`)
            .setFooter({ text : 'mommy mystic uwu'})
        ]});
    }
}

module.exports = Balance;