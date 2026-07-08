import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { isDev } from '../utils/accessControl';
import { resolveCharOption, buildCharSearchChoices, buildLorebookNameChoices } from '../utils/rpCommand';
import { logError } from '../utils/log';

/**
 * Detaches a lorebook from a character you created. With no `lorebook_name`, lists
 * the character's lorebooks instead so you can pick one.
 */
class AiRpLorebookRemove extends Command {
  constructor(client: any) {
    super(client, 'rp-lorebook-remove', 'Remove a lorebook from a character you created', [
      {
        name: 'char', description: 'One of your characters (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'lorebook_name', description: 'The lorebook to remove (omit to list them)', type: 3, required: false, autocomplete: true,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'lorebook_name') {
        const choices = await buildLorebookNameChoices(
          this.client.db,
          interaction.options.getString('char'),
          focused.value,
        );
        await interaction.respond(choices);
        return;
      }
      const choices = await buildCharSearchChoices(this.client.db, this.client, focused.value);
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpLorebookRemove autocomplete error:', err);
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

    const name = (interaction.options.getString('lorebook_name') ?? '').trim();
    try {
      if (!name) {
        const books = await this.client.db.rp.getLorebooksByChar(character.charId);
        if (books.length === 0) {
          await interaction.editReply(`**${character.name}** has no lorebooks.`);
          return;
        }
        const embed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`${character.name} — lorebooks`)
          .setDescription(books.map((b: any) => `• **${b.name}** — ${b.type}${b.description ? ` · ${b.description}` : ''}`).join('\n').slice(0, 4000))
          .setFooter({ text: 'Re-run with lorebook_name to remove one.' });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const removed = await this.client.db.rp.deleteLorebook(character.charId, name);
      if (!removed) {
        await interaction.editReply(`**${character.name}** has no lorebook named **${name}**.`);
        return;
      }
      await interaction.editReply(`Removed lorebook **${name}** from **${character.name}**.`);
    } catch (err) {
      logError('AiRpLorebookRemove error:', err);
      await interaction.editReply('Failed to remove the lorebook. Please try again.');
    }
  }
}

export default AiRpLorebookRemove;
