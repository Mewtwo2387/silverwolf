const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const Canvas = require('canvas');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class GrabEmoji extends Command {
  constructor(client) {
    super(client, 'grab-emoji', 'Converts an emoji to a selected file format', [
      {
        name: 'emoji',
        description: 'The emoji to be converted, for example "<:1silverwolf_thumb:1217078357129302048>"',
        type: 3, // string
        required: true,
      },
      {
        name: 'format',
        description: 'The file format to download',
        type: 3, // string
        required: false,
        choices: [
          { name: 'PNG', value: 'png' },
          { name: 'JPEG', value: 'jpeg' },
          { name: 'WEBP', value: 'webp' },
        ],
      },
    ], { blame: 'xei' });
  }

  async run(interaction) {
    try {
      const emojiInput = interaction.options.getString('emoji');
      const format = interaction.options.getString('format') || 'png'; // Default to 'png'
      const emojiRegex = /<a?:\w+:(\d+)>/;
      const match = emojiInput.match(emojiRegex);

      if (!match) {
        interaction.editReply({
          content: 'Please provide a valid **``custom``** emoji.',
          ephemeral: true,
        });
        return;
      }

      const emojiId = match[1];
      const isAnimated = emojiInput.startsWith('<a:'); // Detect if the emoji is animated

      // For animated emojis, we can only provide the original GIF
      if (isAnimated && format !== 'gif') {
        await interaction.editReply({
          content: 'Animated emojis can only be downloaded as GIF format. Please use GIF format for animated emojis.',
          ephemeral: true,
        });
        return;
      }

      // Set the emoji URL with the appropriate format
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;

      // Fetch the emoji image
      const response = await axios.get(emojiUrl, { responseType: 'arraybuffer' });
      let emojiBuffer = Buffer.from(response.data, 'binary');

      // If format conversion is needed and it's not animated, use Canvas
      if (!isAnimated && format !== 'png') {
        try {
          // Load the image using Canvas
          const image = await Canvas.loadImage(emojiBuffer);

          // Create a canvas with the image dimensions
          const canvas = Canvas.createCanvas(image.width, image.height);
          const ctx = canvas.getContext('2d');

          // Draw the image onto the canvas
          ctx.drawImage(image, 0, 0);

          // Convert to the requested format
          if (format === 'jpeg') {
            emojiBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
          } else if (format === 'webp') {
            emojiBuffer = canvas.toBuffer('image/webp', { quality: 0.9 });
          }
        } catch (error) {
          logError('Canvas conversion error:', error);
          // Fallback to original format if conversion fails
          await interaction.editReply({
            content: `Could not convert to ${format.toUpperCase()}. Providing original PNG format instead.`,
            ephemeral: true,
          });
          // Continue with original PNG format
        }
      }

      // Create an attachment for the converted file
      const fileName = `emoji.${format}`;
      const attachment = new AttachmentBuilder(emojiBuffer, { name: fileName });

      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle('Emoji Conversion')
        .setDescription(`Here is your emoji in the requested format: **${format.toUpperCase()}**`)
        .setColor(0x00FF00)
        .setImage(`attachment://${fileName}`);

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      logError('Error processing emoji:', error);
      await interaction.editReply({
        content: 'There was an error processing the emoji. Please check if the emoji exists and the format is valid.',
        ephemeral: true,
      });
    }
  }
}

module.exports = GrabEmoji;
