import fs from 'fs';
import path from 'path';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class Hilichurl extends Command {
  constructor(client: any) {
    super(client, 'hilichurl', 'our 69th command', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const gifsPath = path.join(import.meta.dir, '../data/hilichurl.json');
      const gifs = JSON.parse(fs.readFileSync(gifsPath, 'utf8'));
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      await interaction.editReply({ content: randomGif });
    } catch (error) {
      logError('Error fetching Hilichurl GIF:', error);
      await interaction.editReply({ content: 'Sorry, I couldn\'t fetch a Hilichurl GIF. Please try again later.', ephemeral: true });
    }
  }
}

export default Hilichurl;
