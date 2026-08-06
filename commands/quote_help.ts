import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { FAKEQUOTE_FONTS, QUOTE_PREF_FIELDS, QUOTE_PREF_LABELS } from '../utils/quote';

const FONT_LIST = FAKEQUOTE_FONTS.map((font, index) => `\`${index + 1}\` ${font.label} — \`${font.value}\``).join('\n');

const FLAG_TABLE = [
  '`w` `white` / `b` `black` — background',
  '`v` `vertical` / `h` `landscape` — layout',
  '`#ff0124` (or `ff0124`) — text colour',
  '`normal` `bw` `inverted` `sepia` `nightmare` — profile picture filter',
  '`server` / `global` — which avatar to use',
  `\`1\`–\`${FAKEQUOTE_FONTS.length}\` or a font name — font (see below)`,
  '`-o` — ignore your saved settings for this quote',
].join('\n');

class QuoteHelp extends Command {
  constructor(client: any) {
    super(client, 'help', 'how to use quotes, mention flags and saved settings', [], {
      isSubcommandOf: 'quote',
      blame: 'both',
    });
  }

  async run(interaction: any): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('Blurple')
      .setTitle('Quote — how it works')
      .setDescription(
        '**Reply-quote:** reply to any message, mention me, and add flags — ' +
          '`@Silverwolf w v caveat #ff0124`\n' +
          '**Slash:** `/quote fake` for a made-up quote, `/quote settings` for your defaults.\n\n' +
          "Flags are order-independent and all optional; anything I don't recognise is ignored, " +
          'so a normal sentence never breaks a quote. If two flags set the same thing, the last one wins.',
      )
      .addFields(
        { name: 'Flags', value: FLAG_TABLE },
        { name: 'Fonts', value: FONT_LIST },
        {
          name: 'Saved settings',
          value:
            `\`/quote settings\` stores your own defaults (${QUOTE_PREF_FIELDS.map((field) =>
              QUOTE_PREF_LABELS[field].toLowerCase(),
            ).join(', ')}) and they apply to every quote **you** make, slash or mention.\n` +
            '`/quote settings clear:Everything` wipes them; `clear:<field>` unsets just one.',
        },
        {
          name: 'Override (`-o`)',
          value:
            'Saved settings are applied *under* the flags you type, so a flag always wins for that ' +
            'one field. To ignore your saved settings **entirely** for a single quote, add `-o` ' +
            '(aliases: `--override`, `-d`, `--default`) — you get the bot defaults plus whatever ' +
            "flags you pass alongside it. On slash commands that's `override:True`.\n" +
            'Precedence: **bot defaults → your saved settings → flags on this quote**.',
        },
        {
          name: 'Examples',
          value:
            '`@Silverwolf` — your saved settings, or plain black landscape\n' +
            '`@Silverwolf v w playfair` — portrait, white, Playfair\n' +
            '`@Silverwolf -o` — bot defaults, ignoring your saved settings\n' +
            '`@Silverwolf -o v` — portrait on bot defaults\n' +
            '`@Silverwolf bg:w font:3 fmt:v` — the old `key:value` spelling still works',
        },
      );

    await interaction.editReply({ embeds: [embed] });
  }
}

export default QuoteHelp;
