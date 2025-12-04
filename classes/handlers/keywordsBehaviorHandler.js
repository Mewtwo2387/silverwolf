const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { log, logError } = require('../../utils/log');

const { resolvePersona, generateContent } = require('../../utils/ai');

const WEBHOOK_NAME = process.env.WEBHOOK_NAME || 'grok-webhook';

module.exports = {
  girlCockx: async (message) => {
    const username = message.author.username.toLowerCase();
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

    // Resolve the persona, which now can include `responseModalities`
    const persona = await resolvePersona(query);
    const displayName = persona.name;

    let prompt = '';

    if (contextMsg) {
      const promptName = (contextMsg.author.username === displayName) ? 'You' : contextMsg.author.username;
      prompt = `Previous message by ${promptName}: "${contextMsg.content}"
      
      User ${username} said: ${query}`;
    } else {
      prompt = `User ${username} said: ${query}`;
    }

    log(`Prompt: ${prompt}`);

    if (displayName === 'Imgen' && message.channel.id !== '1307601349906665492') {
      await message.reply('Imgen is only available in the ai slop channel.');
      return;
    }

    const avatarURL = persona.avatarURL || message.client.user.displayAvatarURL();

    try {
      const webhooks = await message.channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.name === WEBHOOK_NAME);

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
          avatarURL,
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
          name: WEBHOOK_NAME,
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
        avatarURL,
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
          avatarURL,
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
  chalker: async (message) => {
    const userid = '911042005113643070';
    try {
      const { guild } = message;
      await guild.bans.create(userid, { reason: 'placeholder reason' });
    } catch
    (err) {
      logError('Error fetching guild ID:', err);
    }
  },
  avadaKedavra: async (message) => {
    if (!message.member || !message.member.permissions.has('Administrator')) {
      await message.reply('You need intent to kill.');
      return;
    }

    const targetUser = message.mentions.users.first();
    let targetId = null;

    if (targetUser) {
      targetId = targetUser.id;
    } else {
      const banid = message.references?.messageId;
      if (banid) {
        try {
          const referenced = await message.channel.messages.fetch(banid);
          targetId = referenced.author.id;
        } catch (fetchError) {
          await message.reply('Could not find the referenced message. Make sure it exists.');
          logError('Error fetching referenced message for Avada Kedavra:', fetchError);
          return;
        }
      }
    }

    if (!targetId) {
      await message.reply('The killing curse needs a target.');
      return;
    }

    try {
      await message.guild.bans.create(targetId, { reason: 'Avada Kedavra' });
      await message.reply(`<@${targetId}> has been Avada Kedavra'd[.](https://tenor.com/view/avada-kadavra-star-wars-voldemort-spell-gif-16160198)`);
    } catch (err) {
      logError('Error executing Avada Kedavra:', err);
      await message.reply('https://tenor.com/view/voldemort-death-harry-potter-dust-gif-21709239 ');
    }
  },

};
