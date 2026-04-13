import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { generateContent, getPersonaByName } from '../utils/ai';
import { log, logError } from '../utils/log';
import { fetchMessagesByTime } from '../utils/fetch';

class Summary extends Command {
  constructor(client: any) {
    super(client, 'time', 'Summarize messages from the last n hours/minutes', [
      {
        name: 'hours',
        description: 'The number of hours',
        type: 4,
        required: true,
      },
      {
        name: 'minutes',
        description: 'The number of minutes',
        type: 4,
        required: false,
      },
    ], { isSubcommandOf: 'summary', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const hours = interaction.options.getInteger('hours');
    const minutes = interaction.options.getInteger('minutes') || 0;
    const totalMinutes = hours * 60 + minutes;
    const timeLimit = new Date(Date.now() - totalMinutes * 60 * 1000);

    if (totalMinutes <= 0) {
      await interaction.editReply('Invalid time range. Please enter a number greater than 0 minutes.');
      return;
    }

    const messages = await fetchMessagesByTime(interaction.channel, timeLimit.getTime());
    log(`Fetched ${messages.length} messages`);

    if (messages.length === 0) {
      await interaction.editReply(`No messages found in the last ${Math.floor(totalMinutes / 60)} hours and ${totalMinutes % 60} minutes.`);
      return;
    }

    const content = messages.map((message: any) => `Message by ${message[1].author.username}: ${message[1].content}`).join('\n');
    const persona = await getPersonaByName('Summarizer');
    if (!persona) {
      await interaction.editReply('Summarizer persona not configured.');
      return;
    }
    if (persona.systemPromptFile) {
      persona.systemPrompt = await Bun.file(persona.systemPromptFile).text();
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
            .setTitle(`Summary of${messages.length === 1000 ? ' the last' : ''} ${messages.length} messages from the last ${Math.floor(totalMinutes / 60)} hours and ${totalMinutes % 60} minutes`)
            .setDescription(summary.text),
        ],
      },
    );
  }
}

export default Summary;
