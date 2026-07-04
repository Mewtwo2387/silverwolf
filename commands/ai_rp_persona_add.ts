import { Command } from './classes/Command';
import { countTokensOpenRouter } from '../utils/tokenizer';
import { PERSONA_MAX_TOKENS } from '../utils/rpLorebook';
import { logError } from '../utils/log';

const PERSONA_OPTION_MAX_LENGTH = 6000;

/**
 * Sets your roleplay persona (issue #197) — a self-description characters see
 * (inside <userPersona>) when you talk to them in self-mode (1-1) roleplay.
 * One persona per user, global; re-running overwrites it.
 */
class AiRpPersonaAdd extends Command {
  constructor(client: any) {
    super(client, 'rp-persona-add', 'Set your roleplay persona (overwrites any existing one)', [
      {
        name: 'details',
        description: 'Who you are, in your own words — characters you talk to 1-1 will know this',
        type: 3,
        required: true,
        max_length: PERSONA_OPTION_MAX_LENGTH,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const details = (interaction.options.getString('details') ?? '').trim();
    if (!details) {
      await interaction.editReply('Persona details are required.');
      return;
    }
    const tokens = countTokensOpenRouter(details);
    if (tokens > PERSONA_MAX_TOKENS) {
      await interaction.editReply(`Your persona is too long (~${tokens} tokens; the max is ${PERSONA_MAX_TOKENS}). Trim it down.`);
      return;
    }

    try {
      const existing = await this.client.db.rp.getPersona(interaction.user.id);
      await this.client.db.rp.setPersona(interaction.user.id, details);
      await interaction.editReply(
        `${existing ? 'Updated' : 'Set'} your persona. Characters you roleplay with 1-1 (self-mode spawns) `
        + 'will know this about you from their next reply. Remove it with `/ai rp-persona-remove`.',
      );
    } catch (err) {
      logError('AiRpPersonaAdd error:', err);
      await interaction.editReply('Failed to save your persona. Please try again.');
    }
  }
}

export default AiRpPersonaAdd;
