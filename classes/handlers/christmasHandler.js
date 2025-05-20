const {
  EmbedBuilder, escapeMarkdown, AttachmentBuilder,
} = require('discord.js');
const path = require('path');
const Canvas = require('canvas');
const { log } = require('../../utils/log');
require('dotenv').config();
const Handler = require('./handler');

class ChristmasHandler extends Handler {
  async summonShinyPokemon(client, message, member, pfp) {
    log('Santa Pokemon');
    const canvasSize = 512;
    const canvas = Canvas.createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Load the profile picture and draw it on the canvas
    const img = await Canvas.loadImage(pfp);
    ctx.drawImage(img, 0, 0, canvasSize, canvasSize);

    // Apply a red tint to the profile picture
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(data[i] + 50, 255); // Increase red
      data[i + 1] = Math.max(data[i + 1] - 30, 0); // Reduce green
      data[i + 2] = Math.max(data[i + 2] - 30, 0); // Reduce blue
    }
    ctx.putImageData(imageData, 0, 0);

    // Load and overlay the Christmas snow image
    const snowOverlayPath = path.join(__dirname, '../data/images/1christmasSnow.png');
    const snowOverlay = await Canvas.loadImage(snowOverlayPath);
    ctx.drawImage(snowOverlay, 0, 0, canvasSize, canvasSize);

    // Load and overlay the Christmas decoration image
    const decoOverlayPath = path.join(__dirname, '../data/images/1christmasDeco.png');
    const decoOverlay = await Canvas.loadImage(decoOverlayPath);
    ctx.drawImage(decoOverlay, 0, 0, canvasSize, canvasSize);

    // Convert to buffer and send as attachment
    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`A Santa ${escapeMarkdown(member.user.username)} appeared!`)
          .setImage('attachment://shiny.png')
          .setColor('#00FF00')
          .setFooter({ text: 'catch them with /catch santa [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(`santa ${member.user.username}`);
  }

  async summonMysteryPokemon(client, message, member, pfp) {
    // Load the mystery border
    const borderPath = path.join(__dirname, '../data/images/3christmasBorder.png');
    const borderImg = await Canvas.loadImage(borderPath);

    // Create a canvas to fit both profile picture and border
    const canvasSize = 512;
    const canvas = Canvas.createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Load profile picture and scale it to fit the canvas
    const img = await Canvas.loadImage(pfp);
    ctx.drawImage(img, 0, 0, canvasSize, canvasSize);

    // Scale and overlay the border image
    ctx.drawImage(borderImg, 0, 0, canvasSize, canvasSize);

    // Send the final image as an attachment
    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'mystery.png' });
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('A wild ??? appeared!')
        .setImage('attachment://mystery.png')
        .setColor('#00FF00')
        .setFooter({ text: 'guess the username and catch with /catch [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(member.user.username);
  }

  async summonNormalPokemon(client, message, member, pfp) {
    log('Normal Pokemon');
    // Load the border image
    const borderPath = path.join(__dirname, '../data/images/1christmasBorder.png');
    const borderImg = await Canvas.loadImage(borderPath);

    // Create a canvas to fit both profile picture and border
    const canvasSize = 512;
    const canvas = Canvas.createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Load profile picture and scale it to fit the canvas
    const img = await Canvas.loadImage(pfp);
    ctx.drawImage(img, 0, 0, canvasSize, canvasSize);

    // Scale and overlay the border image
    ctx.drawImage(borderImg, 0, 0, canvasSize, canvasSize);

    // Send the final image as an attachment
    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'normal.png' });
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
        .setImage('attachment://normal.png')
        .setColor('#00FF00')
        .setFooter({ text: 'catch them with /catch [username]!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(member.user.username);
  }
}

module.exports = ChristmasHandler;
