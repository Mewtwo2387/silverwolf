import { Command } from './classes/Command';
import { logError } from '../utils/log';
import quote, {
  FAKEQUOTE_FONTS,
  FAKEQUOTE_FORMATS,
  FAKEQUOTE_BACKGROUNDS,
  FAKEQUOTE_PROFILE_COLORS,
  FAKEQUOTE_AVATAR_SOURCES,
  fakeQuoteChoices,
} from '../utils/quote';

class FakeQuote extends Command {
  constructor(client: any) {
    super(client, 'fakequote', 'fake make it a quote', [
      {
        name: 'person',
        description: 'person to quote',
        type: 6,
        required: true,
      },
      {
        name: 'message',
        description: 'message to put in the quote',
        type: 3,
        required: true,
      },
      {
        name: 'nickname',
        description: 'override the display name shown below the quote',
        type: 3,
        required: false,
      },
      {
        name: 'format',
        description: 'image layout (default: landscape)',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_FORMATS),
      },
      {
        name: 'background',
        description: 'background colour (default: black)',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_BACKGROUNDS),
      },
      {
        name: 'font_style',
        description: 'font style for the quote text (default: sans-serif)',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_FONTS),
      },
      {
        name: 'text_color',
        description: 'hex colour for quote text, e.g. #FF00AA (default: white on black, black on white)',
        type: 3,
        required: false,
      },
      {
        name: 'profile_color',
        description: 'profile picture colour filter',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_PROFILE_COLORS),
      },
      {
        name: 'avatar_source',
        description: 'choose between the server avatar or global avatar',
        type: 3,
        required: false,
        choices: fakeQuoteChoices(FAKEQUOTE_AVATAR_SOURCES),
      },
    ], { blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    try {
      await interaction.editReply({
        content: '<a:quoteLoading:1290494754202583110> Generating...',
        fetchReply: true,
      });

      const result = await quote(
        interaction.guild,
        interaction.options.getUser('person'),
        interaction.options.getString('nickname'),
        interaction.options.getString('message'),
        interaction.options.getString('background'),
        interaction.options.getString('text_color'),
        interaction.options.getString('profile_color'),
        interaction.options.getString('avatar_source'),
        interaction.options.getString('font_style'),
        interaction.options.getString('format'),
      );

      await interaction.editReply({ content: null, files: [result] });
    } catch (error) {
      logError('Error generating quote:', error);
      await interaction.editReply(`Error: ${(error as Error).message}`);
    }
  }
}

export default FakeQuote;
