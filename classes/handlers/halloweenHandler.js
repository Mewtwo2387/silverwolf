const {
  EmbedBuilder, escapeMarkdown, AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');
const { log } = require('../../utils/log');
// Note: Bun automatically reads .env files
const Handler = require('./handler');

class HalloweenHandler extends Handler {
  applyRedTint(ctx, img) {
    ctx.drawImage(img, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(data[i] + 100, 255); // Increase red
      data[i + 1] = data[i + 1] * 0.5; // Reduce green
      data[i + 2] = data[i + 2] * 0.5; // Reduce blue
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Helper function to apply color inversion
  applyColorInversion(ctx, img) {
    ctx.drawImage(img, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // Invert Red
      data[i + 1] = 255 - data[i + 1]; // Invert Green
      data[i + 2] = 255 - data[i + 2]; // Invert Blue
    }
    ctx.putImageData(imageData, 0, 0);
  }

  async summonShinyPokemon(client, message, member, pfp) {
    log('Nightmare Mode Pokemon');
    const canvas = Canvas.createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    const img = await Canvas.loadImage(pfp);

    // Apply color inversion and red tint with colorful static for "shiny"
    this.applyColorInversion(ctx, img);

    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;

    // Apply red tint and colorful static noise
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(data[i] + 100, 255); // Red tint
      data[i + 1] = data[i + 1] * 0.5;
      data[i + 2] = data[i + 2] * 0.5;

      if (Math.random() < 0.4) {
        const noiseRed = Math.floor(Math.random() * 120) - 60;
        const noiseGreen = Math.floor(Math.random() * 120) - 60;
        const noiseBlue = Math.floor(Math.random() * 120) - 60;

        data[i] = Math.min(Math.max(data[i] + noiseRed, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + noiseGreen, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + noiseBlue, 0), 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });

    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`A nightmare mode ${escapeMarkdown(member.user.username)} appeared!`)
        .setImage('attachment://shiny.png')
        .setColor('#00FF00')
        .setFooter({ text: 'Nightmarish Halloween! Catch it with /catch Nightmare mode [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(`Nightmare mode ${member.user.username}`);
  }

  async summonMysteryPokemon(client, message, member, pfp) {
    log('Mystery Pokemon');
    // Apply only color inversion for "mystery"
    const canvas = Canvas.createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    const img = await Canvas.loadImage(pfp);
    this.applyColorInversion(ctx, img);

    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'mystery.png' });

    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('A wild ??? appeared!')
        .setImage('attachment://mystery.png')
        .setColor('#00FF00')
        .setFooter({ text: 'Horror Halloween! Guess the username and catch with /catch [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(member.user.username);
  }

  async summonNormalPokemon(client, message, member, pfp) {
    log('Normal Pokemon');
    // Apply only red tint for normal
    const canvas = Canvas.createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    const img = await Canvas.loadImage(pfp);
    this.applyRedTint(ctx, img);

    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'normal.png' });

    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
        .setImage('attachment://normal.png')
        .setColor('#00FF00')
        .setFooter({ text: 'Spooky Halloween! Catch it with /catch [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(member.user.username);
  }
}

module.exports = HalloweenHandler;
