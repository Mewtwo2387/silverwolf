const axios = require('axios');
const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const MusicLinks = require('../data/spotifyPlaylist.json');
const { logError } = require('../utils/log');

class playlistCommand extends Command {
    constructor(client) {
        super(client, "spotify-playlist", "Get a random song", []);
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
