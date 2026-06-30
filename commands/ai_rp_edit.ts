import { Command } from './classes/Command';
import {
  validateCharName, DETAILS_MAX_LENGTH, STARTING_MESSAGE_MAX_LENGTH, formatCharHandle,
} from '../utils/rpIdentity';
import { processAvatar, hostAvatar } from '../utils/rpAvatar';
import { resolveCharOption, buildCharSearchChoices, characterEmbed } from '../utils/rpCommand';
import { logError } from '../utils/log';

/** Edits a character you own. Only the creator can edit; others are rejected. */
class AiRpEdit extends Command {
  constructor(client: any) {
    super(client, 'rp-edit', 'Edit a roleplay character you created', [
      {
        name: 'char', description: 'One of your characters (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'name', description: 'New name', type: 3, required: false,
      },
      {
        name: 'details', description: 'New personality / background', type: 3, required: false,
      },
      {
        name: 'starting_message', description: 'New opening message', type: 3, required: false,
      },
      {
        name: 'pfp', description: 'New avatar image (auto-cropped to 128×128)', type: 11, required: false,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const focused = interaction.options.getFocused();
      const all = await buildCharSearchChoices(this.client.db, this.client, focused);
      // Only suggest the user's own characters (the id is the trailing token in the label).
      const owned = await this.client.db.rp.searchCharacters(focused);
      const ownIds = new Set(owned.filter((r: any) => r.creatorId === interaction.user.id).map((r: any) => r.charId));
      await interaction.respond(all.filter((c) => ownIds.has(c.value)));
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

    const newName = interaction.options.getString('name') ?? character.name;
    const newDetails = interaction.options.getString('details') ?? character.details;
    const newStarting = interaction.options.getString('starting_message') ?? character.startingMessage;
    const attachment = interaction.options.getAttachment('pfp');

    if (interaction.options.getString('name')) {
      const nameError = validateCharName(newName);
      if (nameError) { await interaction.editReply(nameError); return; }
    }
    if (newDetails.length > DETAILS_MAX_LENGTH) {
      await interaction.editReply(`Details are too long (max ${DETAILS_MAX_LENGTH} characters).`); return;
    }
    if (newStarting.length > STARTING_MESSAGE_MAX_LENGTH) {
      await interaction.editReply(`Starting message is too long (max ${STARTING_MESSAGE_MAX_LENGTH} characters).`); return;
    }

    let processedBuffer: Buffer | null = null;
    if (attachment) {
      const processed = await processAvatar(attachment);
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
      const embed = await characterEmbed(this.client, this.client.db, fresh, `@${interaction.user.username}`);
      await interaction.editReply({
        content: `Updated **${newName}** \`${formatCharHandle(newName, character.charId)}\`. Live spawns pick up the change on their next reply.${pfpWarning}`,
        embeds: [embed],
      });
    } catch (err) {
      logError('AiRpEdit error:', err);
      await interaction.editReply('Failed to edit the character. Please try again.');
    }
  }
}

export default AiRpEdit;
