const {
  EmbedBuilder, escapeMarkdown, AttachmentBuilder,
} = require('discord.js');
const Canvas = require('canvas');
const { log } = require('../../utils/log');
// Note: Bun automatically reads .env files
const Handler = require('./handler');

class NormalHandler extends Handler {
  async summonShinyPokemon(client, message, member, pfp) {
    log('Shiny Pokemon');
    const canvas = Canvas.createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    const img = await Canvas.loadImage(pfp);
    ctx.drawImage(img, 0, 0, 512, 512);
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const { data } = imageData;

    // Invert colors
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // Red
      data[i + 1] = 255 - data[i + 1]; // Green
      data[i + 2] = 255 - data[i + 2]; // Blue
      // Alpha (data[i + 3]) remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`A shiny ${escapeMarkdown(member.user.username)} appeared!`)
        .setImage('attachment://shiny.png')
        .setColor('#00FF00')
        .setFooter({ text: 'catch them with /catch [username] shiny!' }),
      ],
      files: [attachment],
    });
    client.setCurrentPokemon(`${member.user.username} shiny`);
  }

  async summonMysteryPokemon(client, message, member, pfp) {
    log('Mystery Pokemon');
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('A wild ??? appeared!')
        .setImage(pfp)
        .setColor('#00FF00')
        .setFooter({ text: 'guess the username and catch with /catch [username]!' }),
      ],
    });
    client.setCurrentPokemon(member.user.username);
  }

  async summonNormalPokemon(client, message, member, pfp) {
    log('Normal Pokemon');
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
        .setImage(pfp)
        .setColor('#00FF00')
        .setFooter({ text: 'catch them with /catch [username]!' }),
      ],
    });
    client.setCurrentPokemon(member.user.username);
  }
}

module.exports = NormalHandler;
