import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Message,
  type TextChannel,
} from 'discord.js';
import { log, logError } from '../../utils/log';
import { resolvePersona, generateContent, generateTitleForHistory } from '../../utils/ai';
import { IMAGE_GEN_TOOL_NAME } from '../../utils/imageGen';
import { trimHistoryToFit } from '../../utils/tokenizer';
import { extractPdfsFromMessage } from '../../utils/pdf';

const WEBHOOK_NAME = process.env.WEBHOOK_NAME || 'grok-webhook';

const scriptHandlers = {
  girlCockx: async (message: Message): Promise<void> => {
    const xLinkRegex = /https:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/g;
    const girlcockxContent = message.content.replace(xLinkRegex, (_, user, id) => `https://fxtwitter.com/${user}/status/${id}/en`);

    try {
      const webhooks = await (message.channel as TextChannel).fetchWebhooks();
      let webhook = webhooks.find((wh: any) => wh.name === 'girlcockx' && wh.token);

      if (!webhook) {
        webhook = await (message.channel as TextChannel).createWebhook({
          name: 'girlcockx',
          avatar: message.client.user!.displayAvatarURL(),
        });
      }

      let content = girlcockxContent;
      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      const deleteButton = new ButtonBuilder()
        .setCustomId(`del_girlcockx_${message.author.id}`)
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);

      if (message.reference?.messageId) {
        try {
          const repliedTo = await message.channel.messages.fetch(message.reference.messageId);
          const repliedLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${repliedTo.id}`;

          const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel(`↩ Replying to: ${repliedTo.author.username}`)
              .setStyle(ButtonStyle.Link)
              .setURL(repliedLink),
            deleteButton,
          );

          components.push(buttonRow);
          content = `<@${repliedTo.author.id}> - ${girlcockxContent}`;
        } catch (err) {
          logError('Could not fetch replied-to message:', err);
          components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton));
        }
      } else {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton));
      }

      await webhook!.send({
        content,
        username: (message.member?.displayName || message.author.username),
        avatarURL: (message.member?.displayAvatarURL() || message.author.displayAvatarURL()),
        components,
        allowedMentions: { parse: ['users'] },
      });

      await message.delete();
    } catch (err) {
      logError('Error sending girlcockx webhook:', err);
    }
  },

  grok: async (message: Message): Promise<void> => {
    const username = message.author?.username
      ? message.author.username.toLowerCase()
      : 'user';
    const query = message.content || '';
    const shouldStartNewSession = /\bkys\b/i.test(query);

    const contextMsg = message.reference
      ? await message.channel.messages
        .fetch(message.reference.messageId!)
        .catch(() => null)
      : null;

    const persona = await resolvePersona(query);
    const displayName = persona.name;

    const NO_MEMORY_PERSONAS = ['Summarizer'];
    const hasMemory = !NO_MEMORY_PERSONAS.includes(displayName);

    if (shouldStartNewSession && hasMemory) {
      try {
        const newSession = await (message.client as any).db.aiChat.startNewSession(
          message.author.id,
          displayName,
        );

        const startedEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('New Session Started')
          .setDescription(
            `Started a new **${displayName}** chat session: **#${newSession.sessionId}**.\n`
            + 'Send your next message to begin the new conversation.',
          );

        await message.reply({ embeds: [startedEmbed] });
      } catch (sessionErr) {
        logError('AiChat: Failed to start new session from mention handler:', sessionErr);
        await message.reply('Failed to start a new conversation. Please try again.');
      }
      return;
    }

    const { blocks: pdfBlocks, notices: pdfNotices } = await extractPdfsFromMessage(message);
    for (const notice of pdfNotices) {
      // eslint-disable-next-line no-await-in-loop
      await message.reply({ content: notice, allowedMentions: { repliedUser: false } })
        .catch((e) => { logError('PDF notice reply failed:', e); });
    }
    const pdfPrefix = pdfBlocks.length > 0 ? `${pdfBlocks.join('\n\n')}\n\n` : '';

    let prompt = '';

    if (contextMsg) {
      const promptName = (contextMsg.author.username === displayName) ? 'You' : contextMsg.author.username;
      prompt = `${pdfPrefix}Previous message by ${promptName}: "${contextMsg.content}"

      User ${username} said: ${query}`;
    } else {
      prompt = `${pdfPrefix}User ${username} said: ${query}`;
    }

    log(`Prompt: ${prompt}`);

    const avatarURL = persona.avatarURL || message.client.user!.displayAvatarURL();

    let aiSession = null;
    let history: any[] = [];
    let historyLoaded = false;
    let hadRawHistory = false;
    let contextWarnings: { level: number; message: string; wasTrimmed: boolean; trimmedCount: number }[] = [];
    if (hasMemory) {
      try {
        aiSession = await (message.client as any).db.aiChat.getOrCreateSession(
          message.author.id,
          displayName,
        );
        const rawHistory = await (message.client as any).db.aiChat.getHistory(aiSession.sessionId, 100);
        hadRawHistory = rawHistory.length > 0;

        // Tool rows are audit-only and get filtered out before replay anyway —
        // exclude them from the token budget so they don't crowd out real turns.
        const filteredHistory = rawHistory.filter((h: { role: string }) => h.role !== 'tool');

        // Token-based sliding window: trim oldest messages to fit context
        const { trimmedHistory, warnings } = await trimHistoryToFit(
          persona.provider,
          persona.model,
          persona.systemPrompt ?? '',
          filteredHistory,
          prompt,
          persona.webSearchEnabled,
        );
        history = trimmedHistory;
        contextWarnings = warnings;
        historyLoaded = true;

        if (filteredHistory.length !== trimmedHistory.length) {
          log(`AiChat: Trimmed history from ${filteredHistory.length} to ${trimmedHistory.length} messages for session ${aiSession.sessionId}`);
        }
      } catch (histErr) {
        logError('AiChat: Failed to load history, proceeding without it:', histErr);
      }
    }

    try {
      const webhooks = await (message.channel as TextChannel).fetchWebhooks();
      let webhook = webhooks.find((wh: any) => wh.name === WEBHOOK_NAME && wh.token);

      const { text, images, toolCalls } = await generateContent({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt ?? '',
        prompt,
        history,
        webSearchEnabled: persona.webSearchEnabled,
        // Image generation is Discord-only (delivery rides this webhook); the
        // rate limit is keyed to the requesting Discord user.
        imageGen: hasMemory
          ? { userId: message.author.id, db: (message.client as any).db }
          : undefined,
      });

      if (!webhook) {
        webhook = await (message.channel as TextChannel).createWebhook({
          name: WEBHOOK_NAME,
          avatar: avatarURL,
        });
      }

      // Prominent pre-reply notice when history was trimmed — so the user sees
      // it before the wall of AI text, not buried after.
      const trimWarning = contextWarnings.find((w) => w.wasTrimmed);
      if (trimWarning) {
        const trimEmbed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('⚠ Context limit reached')
          .setDescription(`Trimmed **${trimWarning.trimmedCount}** old message${trimWarning.trimmedCount === 1 ? '' : 's'} to fit this model's context window. The oldest parts of the conversation are no longer visible to me.`)
          .setFooter({ text: 'Use "kys" to start a fresh session' });
        try {
          await message.reply({ embeds: [trimEmbed], allowedMentions: { repliedUser: false } });
        } catch (warnErr) {
          logError('Failed to send trim warning embed:', warnErr);
        }
      }

      const MAX_LENGTH = 2000;
      const searchCallCount = (toolCalls ?? []).filter((tc: any) => tc.name !== IMAGE_GEN_TOOL_NAME).length;
      const imageCallHappened = (toolCalls ?? []).some((tc: any) => tc.name === IMAGE_GEN_TOOL_NAME && tc.ok);
      const searchPrefix = searchCallCount > 0
        ? `-# 🔎 searched the web (${searchCallCount})\n`
        : '';
      const imagePrefix = imageCallHappened ? '-# 🎨 generated an image\n' : '';
      let remainingText = `${searchPrefix}${imagePrefix}${(text || '').toString()}`;
      let previousMsg: any = null;
      let filesToAttach: any[] = images || [];

      let currentChunk = remainingText.slice(0, MAX_LENGTH);
      remainingText = remainingText.slice(currentChunk.length).trimStart();

      const componentsForFirstMessage: ActionRowBuilder<ButtonBuilder>[] = [];
      const jumpLinkToOriginal = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
      const replyButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(`↩ Replying to: ${username}`)
          .setStyle(ButtonStyle.Link)
          .setURL(jumpLinkToOriginal),
      );
      componentsForFirstMessage.push(replyButton);

      const sentInitial = await webhook!.send({
        content: currentChunk || (filesToAttach.length > 0 ? '' : '(no content)'),
        username: displayName,
        avatarURL,
        components: componentsForFirstMessage,
        files: filesToAttach,
        allowedMentions: { parse: [] },
      });
      previousMsg = sentInitial;
      // Discord CDN URLs of attached generated images — saved to history so the
      // model has a reference to what it sent (links are signed and expire ~24h).
      const imageCdnUrls: string[] = filesToAttach.length > 0
        ? [...(sentInitial.attachments?.values() ?? [])].map((a: any) => a.url).filter(Boolean)
        : [];
      filesToAttach = [];

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

        const componentsForFollowUp: ActionRowBuilder<ButtonBuilder>[] = [];
        const jumpLinkToPrevious = `https://discord.com/channels/${message.guildId}/${message.channelId}/${previousMsg.id}`;
        const previousButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('⬅ Previous')
            .setStyle(ButtonStyle.Link)
            .setURL(jumpLinkToPrevious),
        );
        componentsForFollowUp.push(previousButton);

        // eslint-disable-next-line no-await-in-loop
        const sent = await webhook!.send({
          content: currentChunk,
          username: displayName,
          avatarURL,
          components: componentsForFollowUp,
          allowedMentions: { parse: [] },
        });
        previousMsg = sent;
      }

      // Post-reply context-usage embed (percentage). Skip if we only had a
      // trim-only warning — that was already shown loudly before the reply.
      const pctWarning = contextWarnings.find((w) => w.level >= 75 || (w.level >= 50 && !w.wasTrimmed));
      if (pctWarning) {
        let warningColor = '#5865F2'; // blue for 50%
        if (pctWarning.level >= 95) warningColor = '#ED4245'; // red
        else if (pctWarning.level >= 75) warningColor = '#FEE75C'; // yellow

        const warningEmbed = new EmbedBuilder()
          .setColor(warningColor as `#${string}`)
          .setDescription(pctWarning.message)
          .setFooter({ text: 'Use "kys" to start a fresh session' });
        try {
          await message.reply({ embeds: [warningEmbed], allowedMentions: { repliedUser: false } });
        } catch (warnErr) {
          logError('Failed to send context warning embed:', warnErr);
        }
      }

      const hasToolCalls = !!(toolCalls && toolCalls.length > 0);
      const hasImages = !!(images && images.length > 0);
      if (hasMemory && aiSession && (text || hasToolCalls || hasImages)) {
        const aiRole = persona.provider === 'openrouter' ? 'assistant' : 'model';
        try {
          await (message.client as any).db.aiChat.addHistory(aiSession.sessionId, 'user', prompt);
          if (hasToolCalls) {
            // Persist tool exchanges between the user message and the final assistant
            // text so chronological order is preserved. These rows are audit-only;
            // they're filtered out when history is replayed to the model.
            for (const tc of toolCalls) {
              // eslint-disable-next-line no-await-in-loop
              await (message.client as any).db.aiChat.addHistory(
                aiSession.sessionId,
                'tool',
                JSON.stringify(tc),
              );
            }
          }
          if (text) {
            await (message.client as any).db.aiChat.addHistory(aiSession.sessionId, aiRole, text);
          } else if (hasImages) {
            const imageMeta = JSON.stringify(images.map((img: any) => ({ name: img.name })));
            await (message.client as any).db.aiChat.addHistory(
              aiSession.sessionId,
              aiRole,
              `[image-only response] ${imageMeta}`,
            );
          }
          if (hasImages && imageCdnUrls.length > 0) {
            await (message.client as any).db.aiChat.addHistory(
              aiSession.sessionId,
              aiRole,
              `[generated image attached: ${imageCdnUrls.join(' ')}] (note: this link expires within ~24 hours)`,
            );
          }

          if (historyLoaded && !hadRawHistory && text) {
            (message.client as any).db.aiChat.getHistory(aiSession.sessionId, 100)
              .then((savedHistory: { role: string; message: string }[]) => generateTitleForHistory(savedHistory))
              .then((title: string | null) => {
                if (title) {
                  return (message.client as any).db.aiChat.updateTitle(aiSession.sessionId, title);
                }
                return undefined;
              })
              .catch((titleErr: unknown) => {
                logError('AiChat: Failed to generate session title:', titleErr);
              });
          }
        } catch (saveErr) {
          logError('AiChat: Failed to save history:', saveErr);
        }
      }
    } catch (err) {
      logError('AI unified handler error', err);
      await message.reply(
        'Either, our code is fucked, their API is fucked, or you are just fucked. Please try again later.',
      );
    }
  },

  stealSticker: async (message: Message): Promise<void> => {
    if (!message.reference) {
      await message.reply('You need to reply to a message with a sticker to steal it!');
      return;
    }

    try {
      const referenced = await message.channel.messages.fetch(message.reference.messageId!);
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

  chalker: async (message: Message): Promise<void> => {
    const userid = '911042005113643070';
    try {
      const { guild } = message;
      await guild!.bans.create(userid, { reason: 'placeholder reason' });
    } catch (err) {
      logError('Error fetching guild ID:', err);
    }
  },

  avadaKedavra: async (message: Message): Promise<void> => {
    if (!message.member || !message.member.permissions.has('Administrator')) {
      await message.reply('You need intent to kill.');
      return;
    }

    const targetUser = message.mentions.users.first();
    let targetId: string | null = null;

    if (targetUser) {
      targetId = targetUser.id;
    } else {
      const banid = message.reference?.messageId;
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
      await message.guild!.bans.create(targetId, { reason: 'Avada Kedavra' });
      await message.reply(`<@${targetId}> has been Avada Kedavra'd[.](https://tenor.com/view/avada-kadavra-star-wars-voldemort-spell-gif-16160198)`);
    } catch (err) {
      logError('Error executing Avada Kedavra:', err);
      await message.reply('https://tenor.com/view/voldemort-death-harry-potter-dust-gif-21709239 ');
    }
  },
};

export default scriptHandlers;
