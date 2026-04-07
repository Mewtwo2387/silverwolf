import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class AiView extends Command {
  constructor(client: any) {
    super(client, 'view', 'View all your AI chat sessions', [], {
      isSubcommandOf: 'ai',
      blame: 'xei',
    });
  }

  async run(interaction: any): Promise<void> {
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

      const displaySessions = sessions.slice(0, 25);
      const overflow = sessions.length - displaySessions.length;

      const rows = displaySessions.map((s: any) => {
        const status = s.active === 1 ? '🟢 Active' : '⚫ Inactive';
        const messageCount = Number.isFinite(Number(s.messageCount)) ? Number(s.messageCount) : 0;
        const messageLabel = messageCount === 1 ? 'message' : 'messages';
        const date = new Date(s.createdAt).toLocaleDateString('en-GB', {
          year: 'numeric', month: 'short', day: 'numeric',
        });
        return `**[${s.sessionId}]** ${s.title || s.personaName} · ${status} · ${messageCount} ${messageLabel} · Created ${date}`;
      });

      const description = rows.join('\n')
        + (overflow > 0 ? `\n\n*…and ${overflow} more session(s) not shown.*` : '');

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Your AI Chat Sessions')
            .setDescription(description)
            .setFooter({ text: 'Use /ai chatnew, /ai chatswitch, or /ai chatdelete.' }),
        ],
      });
    } catch (err) {
      logError('AiView error:', err);
      await interaction.editReply({ content: 'Failed to retrieve your sessions. Please try again.' });
    }
  }
}

export default AiView;
