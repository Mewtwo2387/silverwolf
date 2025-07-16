const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);
const systemInstruction = 'You are a helpful assistant named Grok. Respond clearly and concisely.';
const { EmbedBuilder } = require('discord.js');
const { logError } = require('../../utils/log');

module.exports = {
  girlCockx: async (message) => {
    // eslint-disable-next-line max-len
    const xLinkRegex = /https:\/\/(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/g;
    const girlcockxContent = message.content.replace(xLinkRegex, (_, user, id) => `https://fxtwitter.com/${user}/status/${id}`);

    try {
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === 'girlcockx');

      if (!webhook) {
        webhook = await message.channel.createWebhook({
          name: 'girlcockx',
          avatar: message.client.user.displayAvatarURL(),
        });
      }

      let content = girlcockxContent;
      const components = [];
      if (message.reference?.messageId) {
        try {
          const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
          const repliedLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${repliedTo.id}`;

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Jump to Replied Message')
              .setStyle(ButtonStyle.Link)
              .setURL(repliedLink),
          );

          components.push(buttonRow);
          content = `<@${repliedTo.author.id}> - ${girlcockxContent}`;
        } catch (err) {
          console.warn('Could not fetch replied-to message:', err);
        }
      }

      await webhook.send({
        content,
        username: message.member?.displayName || message.author.username,
        avatarURL: message.member?.displayAvatarURL() || message.author.displayAvatarURL(),
        components,
        allowedMentions: {
          parse: ['users'],
        },
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
        model: 'gemini-2.5-flash',
        systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      const MAX_LENGTH = 2000;
      let remaining = text;
      let firstReply = true;
      let replyMsg = null;

      while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_LENGTH);

        const breakIndex = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf(' '));
        if (breakIndex > 0 && remaining.length > MAX_LENGTH) {
          chunk = remaining.slice(0, breakIndex);
        }

        remaining = remaining.slice(chunk.length).trimStart();

        if (firstReply) {
          // eslint-disable-next-line no-await-in-loop
          replyMsg = await message.reply({
            content: chunk,
            allowedMentions: { parse: [] },
          });
          firstReply = false;
        } else {
          // eslint-disable-next-line no-await-in-loop
          replyMsg = await replyMsg.reply({
            content: chunk,
            allowedMentions: { parse: [] },
          });
        }
      }
    } catch (err) {
      console.error('Grok script error:', err);
      await message.reply('Either, our code is fucked, their API is fucked, or you are just fucked. Please try again later.');
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
