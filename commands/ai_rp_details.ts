import { Command } from './classes/Command';
import {
  resolveCharOption, buildCharSearchChoices, resolveCreatorLabel, buildCharacterView,
} from '../utils/rpCommand';
import { logError } from '../utils/log';

/** Shows a character's full details (preview + attached .txt for long fields). */
class AiRpDetails extends Command {
  constructor(client: any) {
    super(client, 'rp-details', 'View a roleplay character\'s details', [
      {
        name: 'char', description: 'Character (search by name or id)', type: 3, required: true, autocomplete: true,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const focused = interaction.options.getFocused();
      const choices = await buildCharSearchChoices(this.client.db, this.client, focused);
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpDetails autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const value = interaction.options.getString('char');
    const character = await resolveCharOption(this.client.db, value);
    if (!character) {
      await interaction.editReply('No character matched that. Pick one from the suggestions.');
      return;
    }
    const creatorLabel = await resolveCreatorLabel(this.client, character.creatorId);
    const view = await buildCharacterView(this.client, this.client.db, character, creatorLabel);
    await interaction.editReply(view);
  }
}

export default AiRpDetails;
