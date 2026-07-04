import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { isDev } from '../utils/accessControl';
import { resolveCharOption, buildCharSearchChoices, buildLorebookNameChoices } from '../utils/rpCommand';
import { logError } from '../utils/log';

/**
 * Views a character's lorebooks (ephemeral — a lorebook may hold spoilers the
 * character is meant to conceal). Everyone can see names/types/descriptions; the
 * full content dump (file attachments) is creator/dev-only.
 */
class AiRpLorebookView extends Command {
  constructor(client: any) {
    super(client, 'rp-lorebook-view', 'View a character\'s lorebooks (content is creator-only)', [
      {
        name: 'char', description: 'Character (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'lorebook_name', description: 'A specific lorebook (omit for all)', type: 3, required: false, autocomplete: true,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
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
      logError('AiRpLorebookView autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const character = await resolveCharOption(this.client.db, interaction.options.getString('char'));
    if (!character) {
      await interaction.editReply('No character matched that. Pick one from the suggestions.');
      return;
    }
    const canDump = character.creatorId === interaction.user.id || isDev(interaction);
    const name = (interaction.options.getString('lorebook_name') ?? '').trim();

    try {
      let books = await this.client.db.rp.getLorebooksByChar(character.charId);
      if (name) {
        books = books.filter((b: any) => b.nameLower === name.toLowerCase());
        if (books.length === 0) {
          await interaction.editReply(`**${character.name}** has no lorebook named **${name}**.`);
          return;
        }
      } else if (books.length === 0) {
        await interaction.editReply(`**${character.name}** has no lorebooks.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${character.name} — lorebooks`)
        .setDescription(
          books
            .map((b: any) => `• **${b.name}** — ${b.type}${b.description ? ` · ${b.description}` : ''}`)
            .join('\n')
            .slice(0, 4000),
        );

      if (!canDump) {
        embed.setFooter({ text: 'Only the character\'s creator can view the full content.' });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Full dump: one attachment per lorebook, in its original format.
      const files = books.map((b: any) => {
        const ext = b.type === 'keywords' ? 'json' : 'md';
        let body = b.content;
        if (b.type === 'keywords') {
          try { body = JSON.stringify(JSON.parse(b.content), null, 2); } catch { /* dump as stored */ }
        }
        return new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `${b.nameLower.replace(/ /g, '_')}.${ext}` });
      });
      await interaction.editReply({ embeds: [embed], files });
    } catch (err) {
      logError('AiRpLorebookView error:', err);
      await interaction.editReply('Failed to load the lorebooks. Please try again.');
    }
  }
}

export default AiRpLorebookView;
