const axios = require('axios');
const { Command } = require('./classes/command');
const { logError } = require('../utils/log');

class Joke extends Command {
  constructor(client) {
    super(client, 'randomjoke', 'A random joke just like your existence that nobody asked for', [], { blame: 'xei' });
  }

  async run(interaction) {
    const jokeUrl = 'https://official-joke-api.appspot.com/random_joke';

    try {
      const response = await axios.get(jokeUrl);
      const { data } = response;

      // Send the setup message
      await interaction.editReply({ content: data.setup });

      // Delay for 2 seconds before sending the punchline
      setTimeout(() => {
        interaction.followUp({ content: data.punchline });
      }, 2000);
    } catch (error) {
      logError('Failed to retrieve joke:', error);
      await interaction.editReply({ content: 'Failed to retrieve joke. Please try again later.', ephemeral: true });
    }
  }
}

module.exports = Joke;
