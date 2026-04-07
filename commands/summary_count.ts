import { EmbedBuilder } from 'discord.js';
import * as fs from 'fs';
import { Command } from './classes/Command';
import { generateContent, getPersonaByName } from '../utils/ai';
import { log, logError } from '../utils/log';
import { fetchMessagesByCount } from '../utils/fetch';

class Summary extends Command {
  constructor(client: any) {
    super(client, 'count', 'Summarize the last n messages', [
      {
        name: 'n',
        description: 'The number of past messages to summarize',
        type: 4,
        required: true,
      },
    ], { isSubcommandOf: 'summary', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const count = interaction.options.getInteger('n');
    if (count < 1 || count > 1000) {
      await interaction.editReply('Invalid count. Please enter a number between 1 and 1000.');
      return;
    }

    const messages = await fetchMessagesByCount(interaction.channel, count);
    log(`Fetched ${messages.length} messages`);
    const content = messages.map((message: any) => `Message by ${message[1].author.username}: ${message[1].content}`).join('\n');
    const persona = await getPersonaByName('Summarizer');
    if (!persona) {
      await interaction.editReply('Summarizer persona not configured.');
      return;
    }
    if (persona.systemPromptFile) {
      const systemPromptFile = await new Promise<string>((resolve, reject) => {
        fs.readFile(persona.systemPromptFile!, 'utf8', (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      persona.systemPrompt = systemPromptFile;
    }

    let summary: any;
    try {
      summary = await generateContent({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt ?? '',
        prompt: content,
      });
      log(`Generated summary: ${summary.text}`);
    } catch (error) {
      logError('Failed to generate summary:', error);
      await interaction.editReply('Failed to generate summary. Please try again later.');
      return;
    }

    await interaction.editReply(
      {
        embeds: [
          new EmbedBuilder()
            .setTitle(`Summary of ${messages.length} messages`)
            .setDescription(summary.text),
        ],
      },
    );
  }
}

export default Summary;
