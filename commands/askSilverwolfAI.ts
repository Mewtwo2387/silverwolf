import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { log, logError } from '../utils/log';
import { getPersonaByName, generateContent, generateTitleForHistory } from '../utils/ai';
import { trimHistoryToFit } from '../utils/tokenizer';

const PERSONA_NAME = 'Silverwolf';

class AskSilverwolfAI extends Command {
  constructor(client: any) {
    super(client, 'ask-silverwolf-ai', 'wow this is so cool, should i add an ai art command ?', [
      {
        name: 'prompt',
        description: 'The prompt',
        type: 3,
        required: true,
      },
      {
        name: 'reset',
        description: 'Reset the chat session',
        type: 5,
        required: false,
      },
    ], { blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    const { username } = interaction.user;
    const userPrompt = interaction.options.getString('prompt');
    const reset = interaction.options.getBoolean('reset');
    const prompt = `User ${username.toLowerCase()} said: ${userPrompt}`;

    try {
      const persona = await getPersonaByName(PERSONA_NAME);
      if (!persona) {
        await interaction.editReply({ content: 'Silverwolf persona not configured.' });
        return;
      }

      const aiSession = reset
        ? await this.client.db.aiChat.startNewSession(interaction.user.id, PERSONA_NAME)
        : await this.client.db.aiChat.getOrCreateSession(interaction.user.id, PERSONA_NAME);

      if (!aiSession) {
        await interaction.editReply({ content: 'Failed to start a chat session. Please try again.' });
        return;
      }

      const rawHistory = await this.client.db.aiChat.getHistory(aiSession.sessionId, 100);
      const hadRawHistory = rawHistory.length > 0;
      const filteredHistory = rawHistory.filter((h: { role: string }) => h.role !== 'tool');
      const { trimmedHistory: history, warnings: contextWarnings } = await trimHistoryToFit(
        persona.provider,
        persona.model,
        persona.systemPrompt ?? '',
        filteredHistory,
        prompt,
        persona.webSearchEnabled,
      );

      const { text, toolCalls } = await generateContent({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt ?? '',
        prompt,
        history,
        webSearchEnabled: persona.webSearchEnabled,
      });

      const processedText = (text || '').replace('(Trailblazer)', username);
      const searchPrefix = toolCalls && toolCalls.length > 0
        ? `-# 🔎 searched the web (${toolCalls.length})\n`
        : '';
      const description = `${searchPrefix}${processedText}`;

      log(`Original: ${text}`);
      log(`Processed: ${processedText}`);

      const embed = new EmbedBuilder()
        .setTitle('Silverwolf Ai says:')
        .setDescription(description.slice(0, 4096))
        .setColor(0x0099ff)
        .setFooter({ text: 'Powered by ChatTGP', iconURL: 'https://media.discordapp.net/attachments/969953667597893675/1272422507533828106/Qzrb7Us.png?ex=66baeb4e&is=66b999ce&hm=cf4e7ed0da32e823e5ceb90cd94b1abf3e54cc19f447e38a0aef572af68cd04b&=&format=webp&quality=lossless&width=899&height=899' });

      await interaction.editReply({ content: null, embeds: [embed] });

      const trimWarning = contextWarnings.find((w) => w.wasTrimmed);
      if (trimWarning) {
        const trimEmbed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('Context limit reached')
          .setDescription(`Trimmed **${trimWarning.trimmedCount}** old message${trimWarning.trimmedCount === 1 ? '' : 's'} to fit this model's context window. Use \`reset: True\` or \`/ai chatnew\` to start fresh.`);
        await interaction.followUp({ embeds: [trimEmbed] }).catch((err: unknown) => {
          logError('Failed to send trim warning:', err);
        });
      }

      const aiRole = persona.provider === 'openrouter' ? 'assistant' : 'model';
      await this.client.db.aiChat.addHistory(aiSession.sessionId, 'user', prompt);
      if (toolCalls?.length) {
        for (const tc of toolCalls) {
          await this.client.db.aiChat.addHistory(aiSession.sessionId, 'tool', JSON.stringify(tc));
        }
      }
      if (text) {
        await this.client.db.aiChat.addHistory(aiSession.sessionId, aiRole, text);
      }

      if (!hadRawHistory && text) {
        this.client.db.aiChat.getHistory(aiSession.sessionId, 100)
          .then((savedHistory: { role: string; message: string }[]) => generateTitleForHistory(savedHistory))
          .then((title: string | null) => {
            if (title) {
              return this.client.db.aiChat.updateTitle(aiSession.sessionId, title);
            }
            return undefined;
          })
          .catch((titleErr: unknown) => {
            logError('AiChat: Failed to generate session title:', titleErr);
          });
      }
    } catch (error) {
      logError('Error generating text:', error);
      await interaction.editReply({ content: 'Failed to retrieve response from the AI. Please try again later.' });
    }
  }
}

export default AskSilverwolfAI;
