const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class AiChatdelete extends Command {
  constructor(client) {
    super(client, 'chatdelete', 'Permanently delete one of your AI chat sessions', [
      {
        name: 'session_id',
        description: 'The session ID to delete (visible in /ai view)',
        type: 4, // INTEGER
        required: true,
      },
    ], {
      ephemeral: true,
      isSubcommandOf: 'ai',
      blame: 'xei',
    });
  }

  async run(interaction) {
    const userId = interaction.user.id;
    const sessionId = interaction.options.getInteger('session_id');

    try {
      // Validate before deleting (provides a clearer error than a silent false return)
      const session = await this.client.db.aiChat.getSessionById(sessionId);

      if (!session) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('❌ Session Not Found')
              .setDescription(`No session with ID **${sessionId}** exists.`),
          ],
        });
        return;
      }

      if (session.userId !== userId) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('❌ Access Denied')
              .setDescription('You can only delete your own sessions.'),
          ],
        });
        return;
      }

      // deleteSession does its own ownership check too (defence in depth)
      const deleted = await this.client.db.aiChat.deleteSession(userId, sessionId);

      if (!deleted) {
        await interaction.editReply({ content: 'Could not delete the session. Please try again.' });
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🗑️ Session Deleted')
            .setDescription(
              `Session **#${sessionId}** (${session.personaName}) and all its history have been permanently deleted.`,
            ),
        ],
      });
    } catch (err) {
      logError('AiChatdelete error:', err);
      await interaction.editReply({ content: 'Failed to delete the session. Please try again.' });
    }
  }
}

module.exports = AiChatdelete;
