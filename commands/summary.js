const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { generateContent, getPersonaByName } = require('../utils/ai');
const { log } = require('../utils/log');
const { fetchMessages } = require('../utils/fetch');

class Summary extends Command {
  constructor(client) {
    super(client, 'summary', 'Summarize a message', [
      {
        name: 'count',
        description: 'The number of past messages to summarize',
        type: 4,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const count = interaction.options.getInteger('count');
    if (count < 1 || count > 1000) {
      await interaction.editReply('Invalid count. Please enter a number between 1 and 1000.');
      return;
    }

    const messages = await fetchMessages(interaction.channel, count);
    log(`Fetched ${messages.length} messages`);
    const content = messages.map((message) => `Message by ${message[1].author.username}: ${message[1].content}`).join('\n');
    const persona = await getPersonaByName('Summarizer');
    const summary = await generateContent({
      provider: persona.provider,
      model: persona.model,
      systemPrompt: persona.systemPrompt,
      prompt: content,
    });
    log(`Generated summary: ${summary.text}`);
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

module.exports = Summary;
