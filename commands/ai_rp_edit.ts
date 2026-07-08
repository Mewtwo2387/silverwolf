import { Command } from './classes/Command';
import {
  DETAILS_OPTION_MAX_LENGTH, STARTING_MESSAGE_MAX_LENGTH, NAME_MAX_LENGTH, formatCharHandle,
} from '../utils/rpIdentity';
import { processAvatar, hostAvatar } from '../utils/rpAvatar';
import { resolveCharOption, buildCharacterView } from '../utils/rpCommand';
import {
  loadCharacterJson, validateName, validateDetails, validateStartingMessage,
} from '../utils/rpCharInput';
import { logError } from '../utils/log';

/** Edits a character you own (individual fields, or a full .json replacement). */
class AiRpEdit extends Command {
  constructor(client: any) {
    super(client, 'rp-edit', 'Edit a roleplay character you created', [
      {
        name: 'char', description: 'One of your characters (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'name', description: 'New name', type: 3, required: false, max_length: NAME_MAX_LENGTH,
      },
      {
        name: 'details', description: 'New personality / system prompt', type: 3, required: false, max_length: DETAILS_OPTION_MAX_LENGTH,
      },
      {
        name: 'starting_message', description: 'New opening message', type: 3, required: false, max_length: STARTING_MESSAGE_MAX_LENGTH,
      },
      {
        name: 'pfp', description: 'New avatar image (auto-cropped to 128×128)', type: 11, required: false,
      },
      {
        name: 'json', description: 'Replace name+details+starting_message from a .json (larger details allowed)', type: 11, required: false,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const focused = interaction.options.getFocused();
      // Scope the search to the caller's own characters up front, so their matches
      // aren't dropped when other users' characters fill the global top-25.
      const owned = await this.client.db.rp.searchOwnCharacters(interaction.user.id, focused);
      const choices = owned.slice(0, 25).map((r: any) => ({
        name: `${r.name} · ${r.charId}`.slice(0, 100),
        value: r.charId,
      }));
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpEdit autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const character = await resolveCharOption(this.client.db, interaction.options.getString('char'));
    if (!character) {
      await interaction.editReply('No character matched that. Pick one from the suggestions.');
      return;
    }
    if (character.creatorId !== userId) {
      await interaction.editReply('You can only edit characters you created.');
      return;
    }

    const nameOpt = interaction.options.getString('name');
    const detailsOpt = interaction.options.getString('details');
    const startingOpt = interaction.options.getString('starting_message');
    const jsonAttachment = interaction.options.getAttachment('json');
    const pfpAttachment = interaction.options.getAttachment('pfp');

    const hasTextOptions = !!(nameOpt || detailsOpt || startingOpt);
    if (jsonAttachment && hasTextOptions) {
      await interaction.editReply('Use **either** the fields **or** a `.json` — not both. (The `pfp` is separate.)');
      return;
    }
    if (!jsonAttachment && !hasTextOptions && !pfpAttachment) {
      await interaction.editReply('Nothing to change — provide a new name / details / starting_message, a `.json`, or a `pfp`.');
      return;
    }

    let newName = character.name;
    let newDetails = character.details;
    let newStarting = character.startingMessage;
    if (jsonAttachment) {
      const loaded = await loadCharacterJson(jsonAttachment);
      if (!loaded.ok) { await interaction.editReply(loaded.error); return; }
      ({ name: newName, details: newDetails, startingMessage: newStarting } = loaded.fields);
    } else {
      if (nameOpt) newName = nameOpt;
      if (detailsOpt) newDetails = detailsOpt;
      if (startingOpt) newStarting = startingOpt;
      let err: string | null = null;
      if (nameOpt) err = validateName(newName);
      if (!err && detailsOpt) err = validateDetails(newDetails);
      if (!err && startingOpt) err = validateStartingMessage(newStarting);
      if (err) { await interaction.editReply(err); return; }
    }

    let processedBuffer: Buffer | null = null;
    if (pfpAttachment) {
      const processed = await processAvatar(pfpAttachment);
      if (!processed.ok) { await interaction.editReply(processed.error); return; }
      processedBuffer = processed.buffer;
    }

    try {
      await this.client.db.rp.updateCharacter(character.charId, userId, {
        name: newName, details: newDetails, startingMessage: newStarting,
      });

      let pfpWarning = '';
      if (processedBuffer) {
        const hosted = await hostAvatar(
          this.client,
          this.client.db,
          interaction.guild.id,
          character.charId,
          processedBuffer,
        );
        if (hosted.ok) {
          await this.client.db.rp.updateCharacterPfp(character.charId, {
            url: hosted.url, messageId: hosted.messageId, channelId: hosted.channelId,
          });
        } else {
          pfpWarning = `\n\n⚠️ Details saved, but the avatar wasn't updated: ${hosted.error}`;
        }
      }

      const fresh = await this.client.db.rp.getCharacter(character.charId);
      const view = await buildCharacterView(this.client, this.client.db, fresh, `@${interaction.user.username}`);
      await interaction.editReply({
        content: `Updated **${newName}** \`${formatCharHandle(newName, character.charId)}\`. Live spawns pick up the change on their next reply.${pfpWarning}`,
        ...view,
      });
    } catch (err) {
      logError('AiRpEdit error:', err);
      await interaction.editReply('Failed to edit the character. Please try again.');
    }
  }
}

export default AiRpEdit;
