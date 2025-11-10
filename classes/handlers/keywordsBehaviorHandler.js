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

function resolvePersona(messageContent = '') {
  const contentLower = messageContent.toLowerCase();
  const personas = personasConfig.personas || [];
  const foundPersona = personas.find(
    (p) => Array.isArray(p.triggers)
      && p.triggers.some((t) => contentLower.includes(String(t).toLowerCase())),
  );

  if (foundPersona) {
    return foundPersona;
  }

  const defaults = personasConfig.defaults || {};
  return {
    name: 'Default',
    provider: defaults.provider || 'gemini',
    model: defaults.model || 'gemini-2.5-flash',
    systemPrompt: defaults.systemPrompt || 'You are a helpful AI assistant.',
    responseModalities: defaults.responseModalities || ['TEXT'],
  };
}

/**
 * Generates content (text and/or images) from the specified AI provider and model.
 * @param {object} options - The generation options.
 * @param {string} options.provider - The AI provider ('openrouter' or 'gemini').
 * @param {string} options.model - The model to use for generation.
 * @param {string} options.systemPrompt - The system instruction/prompt.
 * @param {string} options.prompt - The user's prompt.
 * @param {string[]} [options.responseModalities] - Optional array of desired response modalities (e.g., ['IMAGE', 'TEXT']).
 * @returns {Promise<{text: string, images: Array<{attachment: Buffer, name: string}>}>} - An object containing generated text and an array of image attachments.
 */

async function generateContent({
  provider, model, systemPrompt, prompt, // responseModalities parameter is no longer directly used for switching
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
    return { text: completion.choices?.[0]?.message?.content ?? '', images: [] };
  }

  if (provider === 'gemini') {
    const mimeModule = await import('mime');
    const currentGeminiModel = model;
    let shouldUseSystemInstruction = true;

    if (currentGeminiModel === 'gemini-2.0-flash-preview-image-generation') {
      shouldUseSystemInstruction = false;
    }

    const modelClientOptions = {
      model: currentGeminiModel,
    };

    if (shouldUseSystemInstruction) {
      modelClientOptions.systemInstruction = systemPrompt;
    }

    const modelClient = genAI.getGenerativeModel(modelClientOptions);

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const generateContentStreamOptions = {
      contents,
    };

    if (currentGeminiModel === 'gemini-2.0-flash-preview-image-generation') {
      generateContentStreamOptions.generationConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
      };
    }

    const resultObject = await modelClient.generateContentStream(
      generateContentStreamOptions,
    );

    let fullText = '';
    const imageAttachments = [];
    let fileIndex = 0;

    for await (const chunk of resultObject.stream) {
      if (chunk.candidates?.[0]?.content?.parts) {
        chunk.candidates[0].content.parts.forEach((part) => {
          if (part.inlineData) {
            const { inlineData } = part;
            const fileExtension =
              mimeModule.default.getExtension(inlineData.mimeType || 'image/png')
              || 'png';
            const buffer = Buffer.from(inlineData.data || '', 'base64');
            imageAttachments.push({
              attachment: buffer,
              name: `image_${fileIndex}.${fileExtension}`,
            });
            fileIndex += 1;
          } else if (part.text) {
            fullText += part.text;
          }
        });
      }
    }
    return { text: fullText, images: imageAttachments };
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

    if (message.content.includes('@imgen')) {
      message.content = message.content.replace(/@imgen/g, '').trim();
    }

    const contextMsg = message.reference
      ? await message.channel.messages
        .fetch(message.reference.messageId)
        .catch(() => null)
      : null;

    const prompt = contextMsg
      ? `User asked a follow-up based on this: "${contextMsg.content}"\n\nQuestion: ${query}`
      : query;

    // Resolve the persona, which now can include `responseModalities`
    const persona = resolvePersona(query);
    const displayName = persona.name;

    if (displayName === 'Imgen' && message.channel.id != '1307601349906665492') {
      await message.reply('Imgen is only available in the ai slop channel.');
      return;
    }

    const avatarURL = persona.avatarURL || null;

    try {
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === 'grok-webhook');

      // lightweight censorship mimic (existing logic)
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

      // Call the new `generateContent` function which can return text and/or images
      const { text, images } = await generateContent({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt,
        prompt,
        responseModalities: persona.responseModalities, // Pass the new property from persona
      });

      if (!webhook) {
        webhook = await message.channel.createWebhook({
          name: 'grok-webhook',
          avatar: avatarURL,
        });
      }

      const MAX_LENGTH = 2000;
      let remainingText = (text || '').toString(); // Use a distinct variable name
      let previousMsg = null;
      let filesToAttach = images || []; // Images to be sent with the very first message chunk

      // Prepare content for the initial message
      let currentChunk = remainingText.slice(0, MAX_LENGTH);
      remainingText = remainingText.slice(currentChunk.length).trimStart();

      const componentsForFirstMessage = [];
      const jumpLinkToOriginal = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
      const replyButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(`↩ Replying to: ${username}`)
          .setStyle(ButtonStyle.Link)
          .setURL(jumpLinkToOriginal),
      );
      componentsForFirstMessage.push(replyButton);

      // Send the first message, including images if any
      const sentInitial = await webhook.send({
        content: currentChunk || (filesToAttach.length > 0 ? '' : '(no content)'), // Content can be empty if only images
        username: displayName,
        avatarURL: avatarURL || null,
        components: componentsForFirstMessage,
        files: filesToAttach, // Attach images here
        allowedMentions: { parse: [] },
      });
      previousMsg = sentInitial;
      filesToAttach = []; // Clear images after sending them with the first message

      // Continue sending any remaining text chunks
      while (remainingText.length > 0) {
        currentChunk = remainingText.slice(0, MAX_LENGTH);
        const breakIndex = Math.max(
          currentChunk.lastIndexOf('\n'),
          currentChunk.lastIndexOf(' '),
        );

        if (breakIndex > 0 && remainingText.length > MAX_LENGTH) {
          currentChunk = remainingText.slice(0, breakIndex);
        }

        remainingText = remainingText.slice(currentChunk.length).trimStart();

        const componentsForFollowUp = [];
        const jumpLinkToPrevious = `https://discord.com/channels/${message.guildId}/${message.channelId}/${previousMsg.id}`;
        const previousButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('⬅ Previous')
            .setStyle(ButtonStyle.Link)
            .setURL(jumpLinkToPrevious),
        );
        componentsForFollowUp.push(previousButton);

        // eslint-disable-next-line no-await-in-loop
        const sent = await webhook.send({
          content: currentChunk,
          username: displayName,
          avatarURL: avatarURL || null,
          components: componentsForFollowUp,
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
