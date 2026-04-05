import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import Canvas from 'canvas';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class GrabEmoji extends Command {
  constructor(client: any) {
    super(client, 'grab-emoji', 'Converts an emoji to a selected file format', [
      {
        name: 'emoji',
        description: 'The emoji to be converted, for example "<:1silverwolf_thumb:1217078357129302048>"',
        type: 3,
        required: true,
      },
      {
        name: 'format',
        description: 'The file format to download',
        type: 3,
        required: false,
        choices: [
          { name: 'PNG', value: 'png' },
          { name: 'JPEG', value: 'jpeg' },
          { name: 'WEBP', value: 'webp' },
        ],
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const emojiInput = interaction.options.getString('emoji');
      const format = interaction.options.getString('format') || 'png';
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
      const isAnimated = emojiInput.startsWith('<a:');

      if (isAnimated && format !== 'gif') {
        await interaction.editReply({
          content: 'Animated emojis can only be downloaded as GIF format. Please use GIF format for animated emojis.',
          ephemeral: true,
        });
        return;
      }

      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`;

      const response = await fetch(emojiUrl);
      if (!response.ok) throw new Error('Failed to fetch emoji');
      const arrayBuffer = await response.arrayBuffer();
      let emojiBuffer: Buffer = Buffer.from(arrayBuffer);

      if (!isAnimated && format !== 'png') {
        try {
          const image = await Canvas.loadImage(emojiBuffer);
          const canvas = Canvas.createCanvas(image.width, image.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);

          if (format === 'jpeg') {
            emojiBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
          } else if (format === 'webp') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            emojiBuffer = (canvas as any).toBuffer('image/webp', { quality: 0.9 });
          }
        } catch (error) {
          logError('Canvas conversion error:', error);
          await interaction.editReply({
            content: `Could not convert to ${format.toUpperCase()}. Providing original PNG format instead.`,
            ephemeral: true,
          });
        }
      }

      const fileName = `emoji.${format}`;
      const attachment = new AttachmentBuilder(emojiBuffer, { name: fileName });

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

export default GrabEmoji;
