const { DevCommand } = require('./classes/devcommand.js');
const Discord = require('discord.js');
const { format, antiFormat } = require('../utils/math.js');

class Add extends DevCommand {
    constructor(client){
        super(client, "add", "add something to a user", [
            {
                name: 'user',
                description: 'the user to add something to',
                type: 6,
                required: true
            },
            {
                name: 'attr',
                description: 'the thing to add',
                type: 3,
                required: true
            },
            {
                name: 'amount',
                description: 'the amount of something to add',
                type: 3,
                required: true
            }
        ], {isSubcommandOf: "dev"});
    }

    async run(interaction){
        const user = interaction.options.getUser('user');
        
        const amountString = interaction.options.getString('amount');
        const amount = antiFormat(amountString);
        if (isNaN(amount)) {
            await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
                .setColor('#AA0000')
                .setTitle(`Invalid amount`)
                .setDescription(`idk if this parsing actually works`)
            ]});
            return;
            
        }
        
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