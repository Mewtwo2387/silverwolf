import { Command } from './classes/Command';
import { logError } from '../utils/log';

/** Removes your roleplay persona (set with /ai rp-persona-add). */
class AiRpPersonaRemove extends Command {
  constructor(client: any) {
    super(client, 'rp-persona-remove', 'Remove your roleplay persona', [], {
      isSubcommandOf: 'ai', blame: 'xei', ephemeral: true,
    });
  }

  async run(interaction: any): Promise<void> {
    try {
      const removed = await this.client.db.rp.deletePersona(interaction.user.id);
      await interaction.editReply(
        removed
          ? 'Your persona was removed. Characters will no longer be told about you.'
          : 'You don\'t have a persona set. Add one with `/ai rp-persona-add`.',
      );
    } catch (err) {
      logError('AiRpPersonaRemove error:', err);
      await interaction.editReply('Failed to remove your persona. Please try again.');
    }
  }
}

export default AiRpPersonaRemove;
