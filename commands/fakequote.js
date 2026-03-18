const { Command } = require('./classes/command');
const { logError } = require('../utils/log');
const quote = require('../utils/quote');

class FakeQuote extends Command {
  constructor(client) {
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
        name: 'background',
        description: 'background colour (default: black)',
        type: 3,
        required: false,
        choices: [
          { name: 'Black', value: 'black' },
          { name: 'White', value: 'white' },
        ],
      },
      {
        name: 'font_style',
        description: 'font style for the quote text (default: sans-serif)',
        type: 3,
        required: false,
        choices: [
          { name: 'Default (Sans-serif)', value: 'sans-serif' },
          { name: 'Playfair Display (Elegant Serif)', value: 'playfair' },
          { name: 'Caveat (Handwritten)', value: 'caveat' },
          { name: 'Cinzel (Dramatic Classic)', value: 'cinzel' },
          { name: 'Righteous (Bold Display)', value: 'righteous' },
          { name: 'Special Elite (Typewriter)', value: 'special-elite' },
        ],
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
        choices: [
          { name: 'Normal', value: 'normal' },
          { name: 'Black and White', value: 'bw' },
          { name: 'Inverted', value: 'inverted' },
          { name: 'Sepia', value: 'sepia' },
          { name: 'Nightmare Fuel', value: 'nightmare' },
        ],
      },
      {
        name: 'avatar_source',
        description: 'choose between the server avatar or global avatar',
        type: 3,
        required: false,
        choices: [
          { name: 'Server Avatar', value: 'server' },
          { name: 'Global Avatar', value: 'global' },
        ],
      },
    ], { blame: 'both' });
  }

  async run(interaction) {
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
      );

      await interaction.editReply({ content: null, files: [result] });
    } catch (error) {
      logError('Error generating quote:', error);
      await interaction.editReply(`Error: ${error.message}`);
    }
  }
}

module.exports = FakeQuote;
