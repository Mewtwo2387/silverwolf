import { Command } from './classes/Command';
import MusicLinks from '../data/spotifyPlaylist.json';
import { logError } from '../utils/log';

class SpotifyPlaylist extends Command {
  constructor(client: any) {
    super(client, 'spotifyplaylist', 'Get a random song', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
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

export default SpotifyPlaylist;
