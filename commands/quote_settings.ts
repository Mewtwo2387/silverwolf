import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';
import {
  FAKEQUOTE_FONTS,
  FAKEQUOTE_FORMATS,
  FAKEQUOTE_BACKGROUNDS,
  FAKEQUOTE_PROFILE_COLORS,
  FAKEQUOTE_AVATAR_SOURCES,
  FAKEQUOTE_FONT_VALUES,
  FAKEQUOTE_FORMAT_VALUES,
  FAKEQUOTE_BACKGROUND_VALUES,
  FAKEQUOTE_PROFILE_COLOR_VALUES,
  FAKEQUOTE_AVATAR_SOURCE_VALUES,
  fakeQuoteChoices,
  validateAndNormaliseHex,
  QUOTE_PREF_FIELDS,
  QUOTE_PREF_LABELS,
  QUOTE_FLAG_DEFAULTS,
  type QuotePrefField,
  type QuotePreferences,
} from '../utils/quote';

// Slash option → (preference field, allowed values). Anything outside the
// whitelist is rejected rather than stored.
const OPTION_FIELDS: { option: string; field: QuotePrefField; allowed: string[] | null }[] = [
  { option: 'format', field: 'format', allowed: FAKEQUOTE_FORMAT_VALUES },
  { option: 'background', field: 'background', allowed: FAKEQUOTE_BACKGROUND_VALUES },
  { option: 'text_color', field: 'textColor', allowed: null }, // free-form hex, validated below
  { option: 'font_style', field: 'fontStyle', allowed: FAKEQUOTE_FONT_VALUES },
  { option: 'profile_color', field: 'profileColor', allowed: FAKEQUOTE_PROFILE_COLOR_VALUES },
  { option: 'avatar_source', field: 'avatarSource', allowed: FAKEQUOTE_AVATAR_SOURCE_VALUES },
];

const CLEAR_CHOICES = [
  { name: 'Everything', value: 'all' },
  ...QUOTE_PREF_FIELDS.map((field) => ({ name: QUOTE_PREF_LABELS[field], value: field })),
];

function describeDefault(field: QuotePrefField): string {
  if (field === 'textColor') return 'auto (white on black, black on white)';
  return `${QUOTE_FLAG_DEFAULTS[field]}`;
}

function buildSettingsEmbed(prefs: QuotePreferences, note: string | null): EmbedBuilder {
  const lines = QUOTE_PREF_FIELDS.map((field) => {
    const value = prefs[field];
    return value
      ? `**${QUOTE_PREF_LABELS[field]}:** \`${value}\``
      : `**${QUOTE_PREF_LABELS[field]}:** *not set* — bot default (${describeDefault(field)})`;
  });

  const embed = new EmbedBuilder()
    .setColor(Object.keys(prefs).length > 0 ? 'Green' : 'Grey')
    .setTitle('Your quote settings')
    .setDescription(lines.join('\n'))
    .setFooter({
      text: 'Applied to every quote you make. Skip them once with /quote fake override:true, '
        + 'or -o when mention-quoting.',
    });

  if (note) embed.addFields({ name: '​', value: note });
  return embed;
}

class QuoteSettings extends Command {
  constructor(client: any) {
    super(client, 'settings', 'save your personal quote defaults (run with no options to view them)', [
      {
        name: 'format',
        description: 'default image layout',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_FORMATS),
      },
      {
        name: 'background',
        description: 'default background colour',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_BACKGROUNDS),
      },
      {
        name: 'font_style',
        description: 'default font',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_FONTS),
      },
      {
        name: 'text_color',
        description: 'default text colour as hex, e.g. #FF0124',
        type: 3,
        required: false,
      },
      {
        name: 'profile_color',
        description: 'default profile picture filter',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_PROFILE_COLORS),
      },
      {
        name: 'avatar_source',
        description: 'default avatar source',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_AVATAR_SOURCES),
      },
      {
        name: 'clear',
        description: 'unset a saved default (or all of them)',
        type: 3,
        required: false,
        choices: CLEAR_CHOICES,
      },
    ], { ephemeral: true, isSubcommandOf: 'quote', blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const model = this.client.db.quotePreference;

    try {
      const clear = interaction.options.getString('clear');
      const patch: Partial<Record<QuotePrefField, string>> = {};

      OPTION_FIELDS.forEach(({ option, field, allowed }) => {
        const value = interaction.options.getString(option);
        if (value === null || value === undefined) return;
        if (allowed && !allowed.includes(value)) return; // not a known choice — ignore
        patch[field] = value;
      });

      if (patch.textColor) {
        // Throws with a readable message on anything that isn't a 6-digit hex.
        patch.textColor = validateAndNormaliseHex(patch.textColor);
      }

      const changed = Object.keys(patch) as QuotePrefField[];
      const notes: string[] = [];

      if (clear === 'all') {
        await model.clearAllPreferences(userId);
        notes.push('Cleared every saved default.');
      } else if (clear) {
        await model.clearPreference(userId, clear as QuotePrefField);
        notes.push(`Cleared **${QUOTE_PREF_LABELS[clear as QuotePrefField] ?? clear}**.`);
      }

      if (changed.length > 0) {
        await model.setPreferences(userId, patch);
        notes.push(`Saved **${changed.map((field) => QUOTE_PREF_LABELS[field]).join('**, **')}**.`);
      }

      const prefs = await model.getPreferences(userId);
      await interaction.editReply({
        embeds: [buildSettingsEmbed(prefs, notes.length > 0 ? notes.join('\n') : null)],
      });
    } catch (error) {
      logError('Error updating quote settings:', error);
      await interaction.editReply(`Error: ${(error as Error).message}`);
    }
  }
}

export default QuoteSettings;
