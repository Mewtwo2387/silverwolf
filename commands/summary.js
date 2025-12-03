const { Command } = require('./classes/command');
const { generateContent, getPersonaByName } = require('../utils/ai');
const { log } = require('../utils/log');

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
    const messages = await interaction.channel.messages.fetch({ limit: count });
    log(`Fetched ${messages.size} messages`);
    const content = messages.map((message) => `Message by ${message.author.username}: ${message.content}`).join('\n');
    const persona = await getPersonaByName('Summarizer');
    const summary = await generateContent({
      provider: persona.provider,
      model: persona.model,
      systemPrompt: persona.systemPrompt,
      prompt: content,
    });
    log(`Generated summary: ${summary.text}`);
    await interaction.editReply(summary.text);
  }
}

module.exports = Summary;
