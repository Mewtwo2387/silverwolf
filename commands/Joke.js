const axios = require('axios');
const { Command } = require('./classes/command.js');
const { logError } = require('../utils/log');

class RandomJokeCommand extends Command {
    constructor(client) {
        super(client, "randomjoke", "A random joke just like your existence that nobody asked for");
    }

    async run(interaction) {
        const jokeUrl = 'https://official-joke-api.appspot.com/random_joke';

        try {
            const response = await axios.get(jokeUrl);
            const data = response.data;

            // Send the setup message
            await interaction.editReply({ content: data.setup });

            // Delay for 2 seconds before sending the punchline
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Send the punchline message after the delay
            await interaction.followUp({ content: data.punchline });
        } catch (error) {
            logError('Failed to retrieve joke:', error);
            await interaction.editReply({ content: 'Failed to retrieve joke. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = RandomJokeCommand;
