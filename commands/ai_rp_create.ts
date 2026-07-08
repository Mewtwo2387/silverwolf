import { Command } from './classes/Command';
import {
  MAX_CHARS_PER_USER, DETAILS_OPTION_MAX_LENGTH, STARTING_MESSAGE_MAX_LENGTH, NAME_MAX_LENGTH,
  formatCharHandle,
} from '../utils/rpIdentity';
import { processAvatar, hostAvatar } from '../utils/rpAvatar';
import { buildCharacterView } from '../utils/rpCommand';
import {
  loadCharacterJson, validateName, validateDetails, validateStartingMessage, JSON_HELP,
} from '../utils/rpCharInput';
import { logError } from '../utils/log';

/** Creates a roleplay character — via individual fields, or a single uploaded .json. */
class AiRpCreate extends Command {
  constructor(client: any) {
    super(client, 'rp-create-char', 'Create a roleplay character (fill the fields, or upload a .json)', [
      {
        name: 'name', description: 'Name — letters, numbers, spaces, underscores (no dashes)', type: 3, required: false, max_length: NAME_MAX_LENGTH,
      },
      {
        name: 'details', description: 'Personality / system prompt (use a .json for longer)', type: 3, required: false, max_length: DETAILS_OPTION_MAX_LENGTH,
      },
      {
        name: 'starting_message', description: 'Opening message (up to 6000 chars)', type: 3, required: false, max_length: STARTING_MESSAGE_MAX_LENGTH,
      },
      {
        name: 'pfp', description: 'Avatar image (auto-cropped to 128×128)', type: 11, required: false,
      },
      {
        name: 'json', description: 'Upload a character .json instead of the fields (allows larger details)', type: 11, required: false,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const nameOpt = interaction.options.getString('name');
    const detailsOpt = interaction.options.getString('details');
    const startingOpt = interaction.options.getString('starting_message');
    const jsonAttachment = interaction.options.getAttachment('json');
    const pfpAttachment = interaction.options.getAttachment('pfp');

    const hasTextOptions = !!(nameOpt || detailsOpt || startingOpt);
    if (jsonAttachment && hasTextOptions) {
      await interaction.editReply('Provide **either** the individual fields **or** a `.json` file — not both. (The `pfp` is separate and can go with either.)');
      return;
    }

    // Resolve the definition from whichever method was used.
    let fields: { name: string; details: string; startingMessage: string };
    if (jsonAttachment) {
      const loaded = await loadCharacterJson(jsonAttachment);
      if (!loaded.ok) { await interaction.editReply(loaded.error); return; }
      fields = loaded.fields;
    } else {
      const missing: string[] = [];
      if (!nameOpt) missing.push('name');
      if (!detailsOpt) missing.push('details');
      if (!startingOpt) missing.push('starting_message');
      if (missing.length > 0) {
        await interaction.editReply(`Missing: **${missing.join(', ')}**. Fill those in, or upload a \`.json\`:\n${JSON_HELP}`);
        return;
      }
      const err = validateName(nameOpt) || validateDetails(detailsOpt) || validateStartingMessage(startingOpt);
      if (err) { await interaction.editReply(err); return; }
      fields = { name: nameOpt, details: detailsOpt, startingMessage: startingOpt };
    }

    // Cheap advisory check so we can reject before processing an avatar; the real
    // guard is enforced atomically inside createCharacter (below) to close the race.
    const count = await this.client.db.rp.countCharactersByCreator(userId);
    if (count >= MAX_CHARS_PER_USER) {
      await interaction.editReply(`You've hit the limit of ${MAX_CHARS_PER_USER} characters. Delete or reuse one first.`);
      return;
    }

    // Validate the image before creating anything.
    let processedBuffer: Buffer | null = null;
    if (pfpAttachment) {
      const processed = await processAvatar(pfpAttachment);
      if (!processed.ok) { await interaction.editReply(processed.error); return; }
      processedBuffer = processed.buffer;
    }

    try {
      const created = await this.client.db.rp.createCharacter({
        creatorId: userId, name: fields.name, details: fields.details, startingMessage: fields.startingMessage,
      }, MAX_CHARS_PER_USER);
      if (!created.ok) {
        await interaction.editReply(`You've hit the limit of ${MAX_CHARS_PER_USER} characters. Delete or reuse one first.`);
        return;
      }
      const { character } = created;

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
          pfpWarning = `\n\n⚠️ The character was created, but the avatar wasn't set: ${hosted.error}`;
        }
      }

      const fresh = await this.client.db.rp.getCharacter(character.charId);
      const view = await buildCharacterView(this.client, this.client.db, fresh, `@${interaction.user.username}`);
      await interaction.editReply({
        content: `Created **${fields.name}** \`${formatCharHandle(fields.name, character.charId)}\`. Spawn it with \`/ai rp-spawn\`.${pfpWarning}`,
        ...view,
      });
    } catch (err) {
      logError('AiRpCreate error:', err);
      await interaction.editReply('Failed to create the character. Please try again.');
    }
  }
}

export default AiRpCreate;
