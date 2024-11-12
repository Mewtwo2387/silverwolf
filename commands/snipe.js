const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class Snipe extends Command {
    constructor(client) {
        super(client, "snipe", "snipe the last deleted message", 
            [{
                name: "id",
                description: "snipe nth deleted message",
                type: 4,
                required: false
            }]
        );
    }

    async run(interaction) {
        const deletedMessages = this.client.deletedMessages;
        const count = interaction.options.getInteger('id') || 1;
        let total = 0;

        for (const msgData of deletedMessages) {
            const { message, repliedMessageContent, repliedMessageAuthor } = msgData;

            if (message.author.bot) continue; // Skip bot messages
            if (message.channel.id !== interaction.channel.id) continue; // Skip messages from other channels

            total++;
            if (total !== count) continue;

            const embed = new EmbedBuilder()
                .setColor('#00AA00')
                .setTitle(`Deleted Message #${count}`)
                .setDescription(`**${message.author.username}**: ${message.content}`)
                .setTimestamp(message.createdAt);

            // Add replied message details if it exists
            if (repliedMessageContent && repliedMessageAuthor) {
                const replyLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId}`;
                embed.addFields({
                    name: "Replying To",
                    value: `**${repliedMessageAuthor.username}**: [${repliedMessageContent}](${replyLink})`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // If no matching message is found
        const embed = new EmbedBuilder()
            .setColor('#AA0000')
            .setTitle("Snipe Failed!")
            .setDescription(`There are only ${total} deleted messages to snipe in this channel.`);

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = Snipe;
