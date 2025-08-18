const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OpenAI } = require('openai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_TOKEN);
const { EmbedBuilder } = require('discord.js');
const { logError } = require('../../utils/log');

const personasData = require('../../data/aiPersonas.json');

const personasConfig = personasData.personasConfig || personasData;

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://silverwolf.dev/',
    'X-Title': 'Silverwolf',
  },
});

// Resolve persona from triggers in message content
function resolvePersona(messageContent = '') {
  const contentLower = messageContent.toLowerCase();
  const personas = personasConfig.personas || [];
  for (const p of personas) {
    if (
      Array.isArray(p.triggers)
      && p.triggers.some((t) => contentLower.includes(String(t).toLowerCase()))
    ) {
      return p;
    }
  }
  const defaults = personasConfig.defaults || {};
  return {
    name: 'Default',
    provider: defaults.provider || 'gemini',
    model: defaults.model || 'gemini-2.5-flash',
    systemPrompt: defaults.systemPrompt || 'You are a helpful AI assistant.',
  };
}

async function generateText({
  provider, model, systemPrompt, prompt,
}) {
  if (provider === 'openrouter') {
    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    });
    return completion.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'gemini') {
    const modelClient = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });
    const result = await modelClient.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  throw new Error(`Unknown provider: ${provider}`);
}

module.exports = {
  girlCockx: async (message) => {
    const username = message.author.username.toLowerCase();
    // eslint-disable-next-line max-len
    const xLinkRegex = /https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/g;
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
    const username = message.author?.username
      ? message.author.username.toLowerCase()
      : 'user';
    const query = message.content || '';

    const contextMsg = message.reference
      ? await message.channel.messages
        .fetch(message.reference.messageId)
        .catch(() => null)
      : null;

    const prompt = contextMsg
      ? `User asked a follow-up based on this: "${contextMsg.content}"\n\nQuestion: ${query}`
      : query;

    const persona = resolvePersona(query);
    const displayName = persona.name;
    const avatarURL = persona.avatarURL || null;

    try {
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === 'grok-webhook');

      // lightweight censorship mimic
      const censorshipRegex = /(1989|winnie[\s-]?the[\s-]?pooh|tiananmen|taiwan|hong\s?kong|tibet|xinjiang)/i;

      if (displayName === 'Deepseek' && censorshipRegex.test(prompt)) {
        const responses = [
          "I'm sorry, but I cannot provide information on that topic.",
          '⚠️ This topic is not available due to local regulations.',
          'DeepSeek has detected a Level 404 Thoughtcrime. Please proceed to your nearest re-education center.',
          'This conversation has been harmonized ✨. Please enjoy some wholesome content instead.',
          '🚫 Access denied. The Ministry of Truth thanks you for your cooperation.',
          'https://tenor.com/view/nalog-gif-25906765 ',
        ];
        const reply = responses[Math.floor(Math.random() * responses.length)];

        await webhook.send({
          content: reply,
          username: displayName,
          avatarURL: avatarURL || null,
          allowedMentions: { parse: [] },
        });

        return;
      }
      const text = await generateText({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt,
        prompt,
      });
      if (!webhook) {
        webhook = await message.channel.createWebhook({
          name: 'grok-webhook',
          avatar: avatarURL,
        });
      }

      const MAX_LENGTH = 2000;
      let remaining = (text || '(no content)').toString();
      let previousMsg = null;

      while (remaining.length > 0) {
        let chunk = remaining.slice(0, MAX_LENGTH);
        const breakIndex = Math.max(
          chunk.lastIndexOf('\n'),
          chunk.lastIndexOf(' '),
        );

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
          username: displayName,
          avatarURL: avatarURL || null,
          components,
          allowedMentions: { parse: [] },
        });

        previousMsg = sent;
      }
    } catch (err) {
      try {
        logError('AI unified handler error', err);
      } catch (_) {
        logError('AI unified handler error:', err);
      }
      await message.reply(
        'Either, our code is fucked, their API is fucked, or you are just fucked. Please try again later.',
      );
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
