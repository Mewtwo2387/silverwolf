const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

const personasData = require('../data/aiPersonas.json');

const NO_MEMORY_PERSONAS = ['Summarizer'];
const personaChoices = (personasData.personas || [])
  .filter((persona) => !NO_MEMORY_PERSONAS.includes(persona.name))
  .slice(0, 25)
  .map((persona) => ({
    name: persona.name,
    value: persona.name,
  }));

class AiChatnew extends Command {
  constructor(client) {
    super(client, 'chatnew', 'Start a new chat session for a specific AI', [
      {
        name: 'ai',
        description: 'The AI persona to start a new chat with',
        type: 3, // STRING
        required: true,
        choices: personaChoices,
      },
    ], {
      ephemeral: true,
      isSubcommandOf: 'ai',
      blame: 'ei',
    });
  }

  async run(interaction) {
    const userId = interaction.user.id;
    const personaName = interaction.options.getString('ai');

    try {
      const session = await this.client.db.aiChat.startNewSession(userId, personaName);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🆕 New Session Started')
            .setDescription(
              `Started a new **${personaName}** chat session: **#${session.sessionId}**.\n`
              + `Mentioning \`@${personaName.toLowerCase()}\` will now continue this new conversation.`,
            ),
        ],
      });
    } catch (err) {
      logError('AiChatnew error:', err);
      await interaction.editReply({ content: 'Failed to start a new chat session. Please try again.' });
    }
  }
}

module.exports = AiChatnew;
