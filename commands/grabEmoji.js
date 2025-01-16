const { Command } = require('./classes/command.js');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js'); 
const axios = require('axios');
const sharp = require('sharp'); 
const { logError } = require('../utils/log');

class EmojiToFileCommand extends Command {
    constructor(client) {
        super(client, "grab-emoji", "Converts an emoji to a selected file format", [
            {
                name: 'emoji',
                description: 'The emoji to be converted, for example "<:1silverwolf_thumb:1217078357129302048>"',
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

            // Set the emoji URL with the chosen format
            let emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;

            // Fetch the emoji image
            const response = await axios.get(emojiUrl, { responseType: 'arraybuffer' });
            let emojiBuffer = Buffer.from(response.data, 'binary');

            // If the format is GIF and the emoji is not animated, convert it to GIF
            if (format === 'gif' && !isAnimated) {
                emojiBuffer = await sharp(emojiBuffer) // Use sharp to handle conversion
                    .gif()  // Convert the image to GIF format
                    .toBuffer();
            }

            // Create an attachment for the converted file
            const fileName = `emoji.${format}`;
            const attachment = new AttachmentBuilder(emojiBuffer, { name: fileName }); // Use AttachmentBuilder for file

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle('Emoji Conversion')
                .setDescription(`Here is your emoji in the requested format: **${format.toUpperCase()}**`)
                .setColor(0x00FF00)
                .setImage(`attachment://${fileName}`);  // Attach the converted image to the embed

            await interaction.editReply({ embeds: [embed], files: [attachment] });
        } catch (error) {
            logError(`Error processing emoji: ${error}`);
            await interaction.editReply({
                content: 'There was an error processing the emoji. Please check if the emoji exists and the format is valid.',
                ephemeral: true
            });
        }
    }
}

module.exports = EmojiToFileCommand;
