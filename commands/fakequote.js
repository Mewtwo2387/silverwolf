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
        description: 'message',
        type: 3,
        required: true,
      },
      {
        name: 'nickname',
        description: 'nickname of the person',
        type: 3,
        required: false,
      },
      {
        name: 'background',
        description: 'background color (black or white)',
        type: 3,
        required: false,
        choices: [
          { name: 'Black', value: 'black' },
          { name: 'White', value: 'white' },
        ],
      },
      {
        name: 'profile_color',
        description: 'profile picture color options',
        type: 3,
        required: false,
        choices: [
          { name: 'Normal', value: 'normal' },
          { name: 'Black and White', value: 'bw' },
          { name: 'inverted', value: 'inverted' },
          { name: 'sepia', value: 'sepia' },
          { name: 'nightmare fuel', value: 'nightmare' },
        ],
      },
      {
        name: 'avatar_source',
        description: 'Choose between the server avatar or global avatar',
        type: 3,
        required: false,
        choices: [
          { name: 'Server Avatar', value: 'server' },
          { name: 'Global Avatar', value: 'global' },
        ],
      },
    ]);
  }

  async run(interaction) {
    try {
      // Send initial loading message
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
      );

      // Edit the message and send the image
      await interaction.editReply({ content: null, files: [result] });
    } catch (error) {
      logError(error);
      await interaction.editReply(`Error: ${error.message}`);
    }
  }
}

module.exports = FakeQuote;
