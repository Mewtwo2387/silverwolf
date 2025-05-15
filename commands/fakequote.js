/*
Credits:
- ChatGPT
- Copilot
- Mystic's Collei bot
*/

const Canvas = require('canvas');
const { Command } = require('./classes/command');
const { log, logError } = require('../utils/log');

class FakeQuote extends Command {
  constructor(client) {
    super(client, 'fakequote', 'fake make it a quote', [
      {
        name: 'person',
        description: 'person to quote',
        type: 6,
        required: true,
      },
      {
        name: 'message',
        description: 'message',
        type: 3,
        required: true,
      },
      {
        name: 'nickname',
        description: 'nickname of the person',
        type: 3,
        required: false,
      },
      {
        name: 'background',
        description: 'background color (black or white)',
        type: 3,
        required: false,
        choices: [
          { name: 'Black', value: 'black' },
          { name: 'White', value: 'white' },
        ],
      },
      {
        name: 'profileColor',
        description: 'profile picture color options',
        type: 3,
        required: false,
        choices: [
          { name: 'Normal', value: 'normal' },
          { name: 'Black and White', value: 'bw' },
          { name: 'inverted', value: 'inverted' },
          { name: 'sepia', value: 'sepia' },
          { name: 'nightmare fuel', value: 'nightmare' },
        ],
      },
      {
        name: 'avatarSource',
        description: 'Choose between the server avatar or global avatar',
        type: 3,
        required: false,
        choices: [
          { name: 'Server Avatar', value: 'server' },
          { name: 'Global Avatar', value: 'global' },
        ],
      },
    ]);
  }

  async run(interaction) {
    try {
      // Send initial loading message
      await interaction.editReply({
        content: '<a:quoteLoading:1290494754202583110> Generating...',
        fetchReply: true,
      });

      const person = interaction.options.getUser('person');
      const { username } = person;
      const nickname = interaction.options.getString('nickname') || username;
      const message = `"${interaction.options.getString('message')}"`;
      const backgroundColor = interaction.options.getString('background') || 'black';
      const textColor = backgroundColor === 'white' ? 'black' : 'white';
      const profileColor = interaction.options.getString('profileColor') || 'normal';
      const avatarSource = interaction.options.getString('avatarSource') || 'global';

      let pfp;
      if (avatarSource === 'server') {
        try {
          const member = interaction.guild.members.cache.get(person.id);
          if (member && member.avatar) {
            pfp = member.displayAvatarURL({ extension: 'png', size: 512 });
          } else {
            throw new Error('Server avatar not found, falling back to global avatar.');
          }
        } catch (error) {
          logError(`Failed to fetch server avatar: ${error.message}`);
          pfp = person.displayAvatarURL({ extension: 'png', size: 512 }); // Fallback to global avatar
        }
      } else {
        pfp = person.displayAvatarURL({ extension: 'png', size: 512 });
      }

      const canvas = Canvas.createCanvas(1024, 512);
      const ctx = canvas.getContext('2d');
      log('Created canvas');

      // Set background color
      ctx.fillStyle = backgroundColor === 'white' ? '#ffffff' : '#000000';
      ctx.fillRect(0, 0, 1024, 512);
      log(`Filled ${backgroundColor} background`);

      // Load and draw pfp
      const pfpImage = await Canvas.loadImage(pfp);
      if (profileColor === 'bw') {
        // Convert pfp to grayscale
        ctx.drawImage(pfpImage, 0, 0, 512, 512);
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const { data } = imageData;

        // Loop through each pixel and apply grayscale
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg; // Red
          data[i + 1] = avg; // Green
          data[i + 2] = avg; // Blue
        }
        ctx.putImageData(imageData, 0, 0);
        log('Converted pfp to black and white');
      } else if (profileColor === 'inverted') {
        // draw inverted pfp
        ctx.drawImage(pfpImage, 0, 0, 512, 512);
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const { data } = imageData;

        // Loop through each pixel and invert colors
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]; // Red
          data[i + 1] = 255 - data[i + 1]; // Green
          data[i + 2] = 255 - data[i + 2]; // Blue
        }
        ctx.putImageData(imageData, 0, 0);
        log('Inverted pfp');
      } else if (profileColor === 'sepia') {
        // draw sepia pfp
        ctx.drawImage(pfpImage, 0, 0, 512, 512);
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const { data } = imageData;

        // Loop through each pixel and apply sepia tone
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg + 100; // Red
          data[i + 1] = avg + 50; // Green
          data[i + 2] = avg; // Blue
        }
        ctx.putImageData(imageData, 0, 0);
        log('Drew sepia pfp');
      } else if (profileColor === 'nightmare') {
        // Draw pfp with a lighter red tint and significantly increased colorful static-like noise
        ctx.drawImage(pfpImage, 0, 0, 512, 512);
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const { data } = imageData;

        // Step 1: Invert colors
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]; // Invert Red channel
          data[i + 1] = 255 - data[i + 1]; // Invert Green channel
          data[i + 2] = 255 - data[i + 2]; // Invert Blue channel
          // Alpha channel remains the same
        }

        // Step 2: Apply a lighter red tint with increased colorful static-like noise
        for (let i = 0; i < data.length; i += 4) {
          // Apply a lighter red tint
          data[i] = Math.min(data[i] + 100, 255); // Cap Red channel at maximum value
          data[i + 1] = data[i + 1] * 0.5; // Slightly decrease Green channel
          data[i + 2] = data[i + 2] * 0.5; // Slightly decrease Blue channel

          // Add significantly increased colorful static-like noise
          if (Math.random() < 0.4) { // 40% chance to apply noise to each pixel
            // Generate random values for noise in each channel
            const noiseRed = Math.floor(Math.random() * 120) - 60; // Noise range for Red: -90 to +90
            const noiseGreen = Math.floor(Math.random() * 120) - 60; // Noise range for Green: -90 to +90
            const noiseBlue = Math.floor(Math.random() * 120) - 60; // Noise range for Blue: -90 to +90

            // Apply noise to each channel independently
            data[i] = Math.min(Math.max(data[i] + noiseRed, 0), 255); // Red channel
            data[i + 1] = Math.min(Math.max(data[i + 1] + noiseGreen, 0), 255); // Green channel
            data[i + 2] = Math.min(Math.max(data[i + 2] + noiseBlue, 0), 255); // Blue channel
          }
        }

        // Step 3: Draw the modified image data back onto the canvas
        ctx.putImageData(imageData, 0, 0);
        log('Applied color inversion, lighter red tint, and increased colorful static-like noise to pfp');
      } else {
        // Normal pfp
        ctx.drawImage(pfpImage, 0, 0, 512, 512);
        log('Drew normal pfp');
      }

      // text on right
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const maxWidth = 480;
      let fontSize = 36;

      // Create gradient based on background color
      const gradient = ctx.createLinearGradient(384, 0, 512, 0);
      if (backgroundColor === 'white') {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)'); // Start transparent
        gradient.addColorStop(1, 'rgba(255, 255, 255, 1)'); // End white
      } else {
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Start transparent
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // End black
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(384, 0, 128, 512);
      log('Filled gradient');

      ctx.fillStyle = textColor;

      // Split text into lines and adjust font size if necessary
      const lines = this.wrapText(ctx, message, maxWidth, fontSize);
      fontSize = this.adjustFontSize(ctx, lines, maxWidth, fontSize);
      ctx.font = `italic ${fontSize}px sans-serif`;

      // Calculate total text height
      const lineHeight = fontSize * 1.2;
      const textHeight = lines.length * lineHeight;
      const nicknameHeight = 36; // Height of the nickname font
      const usernameHeight = 24; // Height of the username font
      const nicknameMargin = 10; // Margin below the quote for the nickname
      const usernameMargin = 50; // Margin below the quote for the username

      // Calculate total height including nickname and username
      let totalHeight = textHeight + nicknameHeight + nicknameMargin;
      if (username !== nickname) {
        totalHeight += usernameHeight + usernameMargin;
      }

      // Calculate starting Y position to center the text vertically
      const textY = (ctx.canvas.height - totalHeight) / 2;

      // Draw each line of text
      lines.forEach((line, index) => {
        ctx.fillText(`${line}`, 768, textY + (index * lineHeight));
      });
      log('Drew quote');

      // Draw nickname
      ctx.fillStyle = textColor;
      ctx.font = '36px sans-serif';
      ctx.fillText(`- ${nickname}`, 768, textY + textHeight + nicknameMargin);
      log('Drew nickname');

      // Draw username if different from nickname
      if (username !== nickname) {
        ctx.fillStyle = '#808080';
        ctx.font = '24px sans-serif';
        ctx.fillText(`@${username}`, 768, textY + textHeight + nicknameMargin + usernameMargin);
        log('Drew username');
      }

      // footer
      ctx.fillStyle = '#808080';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('silverwolf', 1014, 502);

      // Edit the message and send the image
      await interaction.editReply({ content: null, files: [canvas.toBuffer()] });
    } catch (error) {
      logError(error);
      await interaction.editReply(`Error: ${error.message}`);
    }
  }

  wrapText(ctx, text, maxWidth, fontSize) {
    ctx.font = `italic ${fontSize}px sans-serif`;
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const { width } = ctx.measureText(`${currentLine} ${word}`);
      if (width < maxWidth) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  adjustFontSize(ctx, lines, maxWidth, fontSize) {
    ctx.font = `italic ${fontSize}px sans-serif`;

    // Check if the text fits within the canvas
    let lineHeight = fontSize * 1.2;
    let totalHeight = lines.length * lineHeight;

    while (totalHeight > 350 || lines.some((line) => ctx.measureText(line).width > maxWidth)) {
      fontSize -= 1;
      ctx.font = `italic ${fontSize}px sans-serif`;
      lineHeight = fontSize * 1.2;
      totalHeight = lines.length * lineHeight;
    }

    return fontSize;
  }
}

module.exports = FakeQuote;
