const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class ESnipe extends Command {
    constructor(client){
        super(client, "esnipe", "snipe an edited message", 
            [{
                name: "id",
                description: "snipe nth edited message",
                type: 4,
                required: false
            }]
        );
    }

    async run(interaction){
        const editedMessages = this.client.editedMessages;
        const count = interaction.options.getInteger('id') || 1;
        var total = 0
        for(const msg of editedMessages){
            if(msg.old.author.bot) continue;
            if(msg.old.channel.id !== interaction.channel.id) continue;
            total++;
            if(total !== count) continue;
            const embed = new EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`Edited message #${count}`)
                .setDescription(`Author: ${msg.old.author.username}\nOld: ${msg.old.content}\nNew: ${msg.new.content}`)
                .setTimestamp(msg.new.createdAt);

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#AA0000')
            .setTitle("Snipe failed!")
            .setDescription(`There are only ${total} edited messages to snipe in this channel`);

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = ESnipe;