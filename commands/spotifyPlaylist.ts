import path from 'path';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

let cache: string[] | null = null;

async function getMusicLinks(): Promise<string[]> {
  if (!cache) {
    cache = await Bun.file(path.join(__dirname, '../data/spotifyPlaylist.json')).json();
  }
  return cache!;
}

class SpotifyPlaylist extends Command {
  constructor(client: any) {
    super(client, 'spotifyplaylist', 'Get a random song', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const links = await getMusicLinks();
      const randomLink = links[Math.floor(Math.random() * links.length)];
      await interaction.editReply(`${randomLink}`);
    } catch (error) {
      logError('Failed to fetch activity:', error);
      await interaction.editReply({ content: 'Failed to retrieve activity. Please try again later.' });
    }
  }
}

export default SpotifyPlaylist;
