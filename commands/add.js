const { DevCommand } = require('./classes/devcommand.js');
const Discord = require('discord.js');

class Add extends DevCommand {
    constructor(client){
        super(client, "add", "add mystic credits to a user", [
            {
                name: 'user',
                description: 'the user to add credits to',
                type: 6,
                required: true
            },
            {
                name: 'amount',
                description: 'the amount of credits to add',
                type: 4,
                required: true
            }
        ]);
    }

    async run(interaction){
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        await this.client.db.addCredits(user.id, amount);
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`Added ${amount} mystic credits to ${user.tag}`)
            .setFooter({ text : 'mommy mystic uwu'})
        ]});
    }
}

module.exports = Add;