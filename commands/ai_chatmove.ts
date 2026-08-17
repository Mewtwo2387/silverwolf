import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { getPersonaByName } from '../utils/ai';
import { withAiSessionLock } from '../utils/aiSessionLock';
import { logError } from '../utils/log';

const personasData = require('../data/aiPersonas.json');

const NO_MEMORY_PERSONAS = ['Summarizer'];
const personaChoices = (personasData.personas || [])
  .filter((persona: any) => !NO_MEMORY_PERSONAS.includes(persona.name))
  .slice(0, 25)
  .map((persona: any) => ({
    name: persona.name,
    value: persona.name,
  }));

class AiChatmove extends Command {
  constructor(client: any) {
    super(client, 'chatmove', 'Move a chat\'s history over to a different AI', [
      {
        name: 'session_id',
        description: 'The session ID to move (visible in /ai view)',
        type: 4,
        required: true,
      },
      {
        name: 'ai',
        description: 'The AI persona to move this chat to',
        type: 3,
        required: true,
        choices: personaChoices,
      },
    ], {
      isSubcommandOf: 'ai',
      blame: 'xei',
    });
  }

  async run(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const sessionId = interaction.options.getInteger('session_id');
    const personaName = interaction.options.getString('ai');

    try {
      const persona = await getPersonaByName(personaName);
      if (!persona) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('❌ Unknown AI')
              .setDescription(`No AI named **${personaName}** is configured.`),
          ],
        });
        return;
      }

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
              .setDescription('You can only move your own sessions.'),
          ],
        });
        return;
      }

      if (session.source !== 'discord') {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('❌ Wrong Surface')
              .setDescription('That chat lives on the website. Move it from AI Slop instead.'),
          ],
        });
        return;
      }

      if (session.personaName === persona.name) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FEE75C')
              .setTitle('Already There')
              .setDescription(`Session **#${sessionId}** is already a **${persona.name}** chat.`),
          ],
        });
        return;
      }

      const result = await withAiSessionLock(
        sessionId,
        async (): Promise<
          | { ok: true; session: Record<string, any>; previousPersona: string }
          | { ok: false; reason: 'not_found' | 'forbidden' }
        > => this.client.db.aiChat.reassignSessionPersona(
          userId,
          sessionId,
          persona.name,
        ),
      );

      if (!result.ok) {
        await interaction.editReply({ content: 'Could not move the session. Please try again.' });
        return;
      }

      const mention = `\`@${persona.name.toLowerCase()}\``;
      const wasActive = result.session.active === 1;
      const continuation = wasActive
        ? `Mentioning ${mention} will now continue this conversation.`
        : `Use \`/ai chatswitch\` on **#${sessionId}**, then mention ${mention} to keep talking.`;
      const pauseNote = result.session.moderationFlagged
        ? '\nThis chat is still paused by safety filters — moving it does not lift the pause.'
        : '';

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Chat Moved')
            .setDescription(
              `Moved session **#${sessionId}** from **${result.previousPersona}** to **${persona.name}**.\nThe full conversation history came with it.\n${continuation}${pauseNote}`,
            ),
        ],
      });
    } catch (err) {
      logError('AiChatmove error:', err);
      await interaction.editReply({ content: 'Failed to move session. Please try again.' });
    }
  }
}

export default AiChatmove;
