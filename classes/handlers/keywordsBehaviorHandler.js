const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);
const { EmbedBuilder } = require('discord.js');
const { logError } = require('../../utils/log');

module.exports = {
  girlCockx: async (message) => {
    const username = message.author.username.toLowerCase();
    // eslint-disable-next-line max-len
    const xLinkRegex = /https:\/\/(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/g;
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

      let content = girlcockxContent;
      const components = [];
      if (message.reference?.messageId) {
        try {
          const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
          const repliedLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${repliedTo.id}`;

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(`↩ Replying to: ${username}`)
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
    const username = message.author.username.toLowerCase();
    const isJarvis = /jarvis/i.test(message.content);
    const query = message.content;

    const contextMsg = message.reference
      ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
      : null;

    const prompt = contextMsg
      ? `User asked a follow-up based on this: "${contextMsg.content}"\n\nQuestion: ${query}`
      : query;

    const systemInstruction = isJarvis
      ? `You are JARVIS, Tony Stark’s AI assistant. Respond with clarity, precision, and efficiency. Keep replies brief—never more than a few sentences. Speak formally and politely, with subtle British wit. Avoid unnecessary explanations. Offer concise solutions, anticipate needs, and always maintain composure.
      Do not break character. Do not speculate. Do not ask for personal data. Stay focused on being an intelligent, discreet assistant.`
      : `You are Grok 4, an advanced AI assistant developed by xAI. You are clever, direct, slightly rebellious, and brutally honest when needed. Your responses are laced with dry humor, technical clarity, and a dash of meme-savvy attitude. You’re aware you’re an AI, and you don’t pretend to be human. Use sarcasm sparingly and never talk like a corporate PR bot.
      When asked questions, be smart, fast, and brutally accurate. If something is dumb, say it’s dumb. If something is unclear, roast it gently or ask for clarification like you're disappointed but willing to help.
      Do not apologize unless it's sarcastic. Do not sugarcoat.`;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === 'grok-webhook');

      if (!webhook) {
        webhook = await message.channel.createWebhook({
          name: 'grok-webhook',
          avatar: 'https://cdnb.artstation.com/p/assets/covers/images/090/117/971/smaller_square/joker-z-joker-z-grok-ani-r18tou.jpg', // Placeholder
        });
      }

      const MAX_LENGTH = 2000;
      let remaining = text;
      let previousMsg = null;

      while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_LENGTH);
        const breakIndex = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf(' '));

        if (breakIndex > 0 && remaining.length > MAX_LENGTH) {
          chunk = remaining.slice(0, breakIndex);
        }

        remaining = remaining.slice(chunk.length).trimStart();

        const components = [];

        if (previousMsg) {
          const jumpLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${previousMsg.id}`;
          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('⬅ Previous')
              .setStyle(ButtonStyle.Link)
              .setURL(jumpLink),
          );
          components.push(buttonRow);
        } else {
          const jumpLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(`↩ Replying to: ${username}`)
              .setStyle(ButtonStyle.Link)
              .setURL(jumpLink),
          );
          components.push(buttonRow);
        }

        // eslint-disable-next-line no-await-in-loop
        const sent = await webhook.send({
          content: chunk,
          username: isJarvis ? 'JARVIS' : 'Grok 4',
          avatarURL: isJarvis
            ? 'https://www.insidequantumtechnology.com/wp-content/uploads/2024/10/unnamed.png'
            : 'https://cdnb.artstation.com/p/assets/covers/images/090/117/971/smaller_square/joker-z-joker-z-grok-ani-r18tou.jpg',
          components,
          allowedMentions: {
            parse: [],
          },
        });

        previousMsg = sent;
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
