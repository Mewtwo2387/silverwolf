import { Command } from './classes/Command';
import { isDev } from '../utils/accessControl';
import { resolveCharOption, buildCharSearchChoices } from '../utils/rpCommand';
import {
  MAX_LOREBOOKS_PER_CHAR, LOREBOOK_NAME_MAX_LENGTH, LOREBOOK_DESCRIPTION_MAX_LENGTH,
  validateLorebookName, loadLorebookFile, parseKeywordLorebook, validateSkillContent,
} from '../utils/rpLorebook';
import { logError } from '../utils/log';

/**
 * Attaches a lorebook to a character you created (issue #196). `keywords` takes a
 * .json of trigger/context entries; `skill` takes a .md reference note (with a
 * "use when" description) the character can recall on demand.
 */
class AiRpLorebookAdd extends Command {
  constructor(client: any) {
    super(client, 'rp-lorebook-add', 'Attach a lorebook to a character you created', [
      {
        name: 'char', description: 'One of your characters (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'type',
        description: 'keywords: trigger-word context (.json) · skill: on-demand reference note (.md)',
        type: 3,
        required: true,
        choices: [
          { name: 'keywords', value: 'keywords' },
          { name: 'skill', value: 'skill' },
        ],
      },
      {
        name: 'name', description: 'Lorebook name — letters, numbers, spaces, underscores', type: 3, required: true, max_length: LOREBOOK_NAME_MAX_LENGTH,
      },
      {
        name: 'file', description: 'The lorebook file (.json for keywords, .md for skill)', type: 11, required: true,
      },
      {
        name: 'description',
        description: 'Skill only: when should the character consult this? (e.g. "relationship dynamics")',
        type: 3,
        required: false,
        max_length: LOREBOOK_DESCRIPTION_MAX_LENGTH,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const focused = interaction.options.getFocused();
      // Not scoped to own characters: devs may manage any character's lorebooks.
      const choices = await buildCharSearchChoices(this.client.db, this.client, focused);
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpLorebookAdd autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const character = await resolveCharOption(this.client.db, interaction.options.getString('char'));
    if (!character) {
      await interaction.editReply('No character matched that. Pick one from the suggestions.');
      return;
    }
    if (character.creatorId !== interaction.user.id && !isDev(interaction)) {
      await interaction.editReply('Only the character\'s creator can manage its lorebooks.');
      return;
    }

    const type = interaction.options.getString('type') as 'keywords' | 'skill';
    const name = (interaction.options.getString('name') ?? '').trim();
    const description = (interaction.options.getString('description') ?? '').trim();
    const file = interaction.options.getAttachment('file');

    const nameErr = validateLorebookName(name);
    if (nameErr) { await interaction.editReply(nameErr); return; }
    if (type === 'skill' && !description) {
      await interaction.editReply('A **skill** lorebook needs a `description` — it tells the character when to consult it.');
      return;
    }

    const loaded = await loadLorebookFile(file, type);
    if (!loaded.ok) { await interaction.editReply(loaded.error); return; }

    // Validate + normalize the content per type before storing anything.
    let content: string;
    let summary: string;
    if (type === 'keywords') {
      const parsed = parseKeywordLorebook(loaded.content);
      if (!parsed.ok) { await interaction.editReply(parsed.error); return; }
      content = JSON.stringify(parsed.entries);
      summary = `${parsed.entries.length} entr${parsed.entries.length === 1 ? 'y' : 'ies'}`;
    } else {
      const validated = validateSkillContent(loaded.content);
      if (!validated.ok) { await interaction.editReply(validated.error); return; }
      content = validated.content;
      summary = `"${description}"`;
    }

    try {
      const created = await this.client.db.rp.createLorebook({
        charId: character.charId, name, type, description, content,
      }, MAX_LOREBOOKS_PER_CHAR);
      if (!created.ok) {
        if (created.reason === 'duplicate') {
          await interaction.editReply(`**${character.name}** already has a lorebook named **${name}**. Remove it first to replace it.`);
        } else {
          await interaction.editReply(`**${character.name}** already has the maximum of ${MAX_LOREBOOKS_PER_CHAR} lorebooks.`);
        }
        return;
      }
      await interaction.editReply(
        `Added **${type}** lorebook **${name}** (${summary}) to **${character.name}**. `
        + 'Live spawns pick it up on their next reply.',
      );
    } catch (err) {
      logError('AiRpLorebookAdd error:', err);
      await interaction.editReply('Failed to add the lorebook. Please try again.');
    }
  }
}

export default AiRpLorebookAdd;
