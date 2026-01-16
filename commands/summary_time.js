const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const { Command } = require('./classes/command');
const { generateContent, getPersonaByName } = require('../utils/ai');
const { log, logError } = require('../utils/log');
const { fetchMessagesByTime } = require('../utils/fetch');

class Summary extends Command {
  constructor(client) {
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

  async run(interaction) {
    const hours = interaction.options.getInteger('hours');
    const minutes = interaction.options.getInteger('minutes') || 0;
    const totalMinutes = hours * 60 + minutes;
    const timeLimit = new Date(Date.now() - totalMinutes * 60 * 1000);

    if (totalMinutes <= 0) {
      await interaction.editReply('Invalid time range. Please enter a number greater than 0 minutes.');
      return;
    }

    const messages = await fetchMessagesByTime(interaction.channel, timeLimit);
    log(`Fetched ${messages.length} messages`);

    if (messages.length === 0) {
      await interaction.editReply(`No messages found in the last ${Math.floor(totalMinutes / 60)} hours and ${totalMinutes % 60} minutes.`);
      return;
    }

    const content = messages.map((message) => `Message by ${message[1].author.username}: ${message[1].content}`).join('\n');
    const persona = await getPersonaByName('Summarizer');
    if (!persona) {
      await interaction.editReply('Summarizer persona not configured.');
      return;
    }
    if (persona.systemPromptFile) {
      const systemPromptFile = await new Promise((resolve, reject) => {
        fs.readFile(persona.systemPromptFile, 'utf8', (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      persona.systemPrompt = systemPromptFile;
    }

    let summary;
    try {
      summary = await generateContent({
        provider: persona.provider,
        model: persona.model,
        systemPrompt: persona.systemPrompt,
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

module.exports = Summary;
