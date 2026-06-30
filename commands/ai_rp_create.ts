import { Command } from './classes/Command';
import {
  validateCharName, MAX_CHARS_PER_USER, DETAILS_MAX_LENGTH, STARTING_MESSAGE_MAX_LENGTH,
  formatCharHandle,
} from '../utils/rpIdentity';
import { processAvatar, hostAvatar } from '../utils/rpAvatar';
import { characterEmbed } from '../utils/rpCommand';
import { logError } from '../utils/log';

/** Creates a roleplay character owned by the invoking user. */
class AiRpCreate extends Command {
  constructor(client: any) {
    super(client, 'rp-create-char', 'Create a roleplay character', [
      {
        name: 'name', description: 'Short name (letters/numbers/underscore, no spaces)', type: 3, required: true,
      },
      {
        name: 'details', description: 'Personality / background the character role-plays with', type: 3, required: true,
      },
      {
        name: 'starting_message', description: 'The message the character opens with when spawned', type: 3, required: true,
      },
      {
        name: 'pfp', description: 'Avatar image (auto-cropped to 128×128)', type: 11, required: false,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const name = interaction.options.getString('name');
    const details = interaction.options.getString('details');
    const startingMessage = interaction.options.getString('starting_message');
    const attachment = interaction.options.getAttachment('pfp');

    const nameError = validateCharName(name);
    if (nameError) { await interaction.editReply(nameError); return; }
    if (details.length > DETAILS_MAX_LENGTH) {
      await interaction.editReply(`Details are too long (max ${DETAILS_MAX_LENGTH} characters).`); return;
    }
    if (startingMessage.length > STARTING_MESSAGE_MAX_LENGTH) {
      await interaction.editReply(`Starting message is too long (max ${STARTING_MESSAGE_MAX_LENGTH} characters).`); return;
    }

    const count = await this.client.db.rp.countCharactersByCreator(userId);
    if (count >= MAX_CHARS_PER_USER) {
      await interaction.editReply(`You've hit the limit of ${MAX_CHARS_PER_USER} characters. Delete or reuse one first.`);
      return;
    }

    // Validate the image before creating anything.
    let processedBuffer: Buffer | null = null;
    if (attachment) {
      const processed = await processAvatar(attachment);
      if (!processed.ok) { await interaction.editReply(processed.error); return; }
      processedBuffer = processed.buffer;
    }

    try {
      const character = await this.client.db.rp.createCharacter({
        creatorId: userId, name, details, startingMessage,
      });
      if (!character) { await interaction.editReply('Failed to create the character. Please try again.'); return; }

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
      const embed = await characterEmbed(this.client, this.client.db, fresh, `@${interaction.user.username}`);
      await interaction.editReply({
        content: `Created **${name}** \`${formatCharHandle(name, character.charId)}\`. Spawn it with \`/ai rp-spawn\`.${pfpWarning}`,
        embeds: [embed],
      });
    } catch (err) {
      logError('AiRpCreate error:', err);
      await interaction.editReply('Failed to create the character. Please try again.');
    }
  }
}

export default AiRpCreate;
