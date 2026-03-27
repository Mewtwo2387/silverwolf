const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class AiView extends Command {
  constructor(client) {
    super(client, 'view', 'View all your AI chat sessions', [], {
      ephemeral: true,
      isSubcommandOf: 'ai',
      blame: 'xei',
    });
  }

  async run(interaction) {
    const userId = interaction.user.id;

    try {
      const sessions = await this.client.db.aiChat.getAllUserSessions(userId);

      if (sessions.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('🤖 Your AI Chat Sessions')
              .setDescription("You don't have any sessions yet. Mention an AI (e.g. `@grok`) to start one!"),
          ],
        });
        return;
      }

      // Cap at 25 rows (Discord embed field limit)
      const displaySessions = sessions.slice(0, 25);
      const overflow = sessions.length - displaySessions.length;

      const rows = displaySessions.map((s) => {
        const status = s.active === 1 ? '🟢 Active' : '⚫ Inactive';
        const date = new Date(s.createdAt).toLocaleDateString('en-GB', {
          year: 'numeric', month: 'short', day: 'numeric',
        });
        return `**[${s.sessionId}]** ${s.personaName} · ${status} · Created ${date}`;
      });

      const description = rows.join('\n')
                + (overflow > 0 ? `\n\n*…and ${overflow} more session(s) not shown.*` : '');

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Your AI Chat Sessions')
            .setDescription(description)
            .setFooter({ text: 'Use /ai chatswitch or /ai chatdelete with the session ID shown.' }),
        ],
      });
    } catch (err) {
      logError('AiView error:', err);
      await interaction.editReply({ content: 'Failed to retrieve your sessions. Please try again.' });
    }
  }
}

module.exports = AiView;
