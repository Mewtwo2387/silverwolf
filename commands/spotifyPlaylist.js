const axios = require('axios');
const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const MusicLinks = require('../data/spotifyPlaylist.json');
const { logError } = require('../utils/log.js');

class playlistCommand extends Command {
    constructor(client) {
        super(client, "spotifyplaylist", "Get a random song", []);
    }

    async run(interaction) {
        try {
        const randomIndex = Math.floor(Math.random() * MusicLinks.length);
    const randomLink = MusicLinks[randomIndex];
    await interaction.editReply(`${randomLink}`); 
        } catch (error) {
            logError('Failed to fetch activity:', error);
            await interaction.editReply({ content: 'Failed to retrieve activity. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = playlistCommand;
