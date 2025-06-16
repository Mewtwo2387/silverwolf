const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);
const systemInstruction = 'You are a helpful assistant named Grok. Respond clearly and concisely.';
const { EmbedBuilder } = require('discord.js');
const { logError } = require('../../utils/log');

module.exports = {
  girlCockx: async (message) => {
    const xLinkRegex = /https:\/\/(?:x|twitter|fx|vx|fixupx)\.com\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/g;
    const girlcockxContent = message.content.replace(xLinkRegex, (_, user, id) => `https://girlcockx.com/${user}/status/${id}`);

    try {
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === 'girlcockx');

      if (!webhook) {
        webhook = await message.channel.createWebhook({
          name: 'girlcockx',
          avatar: message.client.user.displayAvatarURL(),
        });
      }

      await webhook.send({
        content: girlcockxContent,
        username: message.member?.displayName || message.author.username,
        avatarURL: message.member.displayAvatarURL(),
        allowedMentions: {
          parse: [] 
        }
      });

      await message.delete();
    } catch (err) {
      console.error('Error sending girlcockx webhook:', err);
    }
  },
  grok: async (message) => {
    const triggerRegex = /@gro[ck]\w*/gi;
    const query = message.content.replace(triggerRegex, '').trim();

    if (!query) {
      await message.reply("Don't ping me if you're not gonna ask anything!");
      return;
    }

    const contextMsg = message.reference
      ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
      : null;

    const prompt = contextMsg
      ? `User asked a follow-up based on this: "${contextMsg.content}"\n\nQuestion: ${query}`
      : query;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      await message.reply({
        content: text,
        allowedMentions: { parse: [] }
      });
    } catch (err) {
      console.error('Grok script error:', err);
      await message.reply('Something went wrong trying to ask Grok. Try again later.');
    }
  },
  stealSticker: async (message) => {
    if (!message.reference) {
      await message.reply('You need to reply to a message with a sticker to steal it!');
      return;
    }

    try {
      const referenced = await message.channel.messages.fetch(message.reference.messageId);
      const sticker = referenced.stickers?.first();

      if (!sticker) {
        await message.reply('CAN YOU LOCK TF IN? THAT MESSAGE DOESNT HAVE A STICKER...[.](https://tenor.com/view/silver-wolf-gif-16998478984526443945)');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Sticker: ${sticker.name}`)
        .setImage(sticker.url)
        .setColor(0x00bcd4)
        .setFooter({ text: `ID: ${sticker.id}` });

      await message.reply({ embeds: [embed] });
    } catch (err) {
      logError('Error fetching sticker:', err);
      await message.reply("Failed to fetch the sticker. Maybe it's gone or inaccessible.");
    }
  },
};
