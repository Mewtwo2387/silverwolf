const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class EmojiToFileCommand extends Command {
    constructor(client) {
        super(client, "grab_emoji", "Converts an emoji to a selected file format", [
            {
                name: 'emoji',
                description: 'The emoji to be converted for example "<:1silverwolf_thumb:1217078357129302048>"',
                type: 3, // string
                required: true
            },
            {
                name: 'format',
                description: 'The file format to download',
                type: 3, // string
                required: false,
                choices: [
                    { name: 'PNG', value: 'png' },
                    { name: 'GIF', value: 'gif' },
                    { name: 'WEBP', value: 'webp' }
                ]
            }
        ]);
    }

    async run(interaction) {
        try {
            const emojiInput = interaction.options.getString('emoji');
            const format = interaction.options.getString('format') || 'png'; // Default to 'png'
            const emojiRegex = /<a?:\w+:(\d+)>/;
            const match = emojiInput.match(emojiRegex);

            if (!match) {
                return interaction.editReply({ content: 'Please provide a valid **``custom``** emoji.', ephemeral: true });
            }

            const emojiId = match[1];
            const isAnimated = emojiInput.startsWith('<a:'); // Detect if the emoji is animated

            // Handle the case where GIF format is requested for a non-animated emoji
            if (format === 'gif' && !isAnimated) {
                return interaction.reply({ content: 'GIF format is only available for animated emojis.', ephemeral: true });
            }

            // Set the emoji URL with the chosen format
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${format}`;

            // Fetch the emoji to ensure it exists
            const response = await axios.get(emojiUrl, { responseType: 'arraybuffer' });
            const emojiBuffer = Buffer.from(response.data, 'binary');

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle('Emoji Conversion')
                .setDescription(`Here is your emoji in the requested format: **${format.toUpperCase()}**`)
                .setColor(0x00FF00)
                .setImage(emojiUrl);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(`Error processing emoji: ${error}`);
            await interaction.editReply({ content: 'There was an error processing the emoji. Please check if the emoji exists and the format is valid.', ephemeral: true });
        }
    }
}

module.exports = EmojiToFileCommand;
