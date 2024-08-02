const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class Snipe extends Command {
    constructor(client){
        super(client, "snipe", "snipe the last deleted message", 
            [{
                name: "id",
                description: "snipe nth deleted message",
                type: 4,
                required: false
            }]
        );
    }

    async run(interaction){
        const deletedMessages = this.client.deletedMessages;
        const count = interaction.options.getInteger('id') || 1;
        var total = 0
        for(const msg of deletedMessages){
            if(msg.author.bot) continue;
            if(msg.channel.id !== interaction.channel.id) continue;
            total++;
            if(total !== count) continue;
            const embed = new EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`Deleted message #${count}`)
                .setDescription(`**${msg.author.username}**: ${msg.content}`)
                .setTimestamp(msg.createdAt);

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#AA0000')
            .setTitle("Snipe failed!")
            .setDescription(`There are only ${total} deleted messages to snipe in this channel`);

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = Snipe;