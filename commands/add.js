const { DevCommand } = require('./classes/devcommand.js');
const Discord = require('discord.js');
const { format } = require('../utils/math.js');

class Add extends DevCommand {
    constructor(client){
        super(client, "add", "add something to a user", [
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
            },
            {
                name: 'attr',
                description: 'the thing to add',
                type: 3,
                required: true
            }
        ]);
    }

    async run(interaction){
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const attr = interaction.options.getString('attr');
        try{
            await this.client.db.addUserAttr(user.id, attr, amount);
        }catch(e){
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`Failed to add ${format(amount)} ${attr} to ${user.tag}`)
            ]});
            return;
        }
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle(`Added ${format(amount)} ${attr} to ${user.tag}`)
        ]});
    }
}

module.exports = Add;