import fs from 'fs';
import path from 'path';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class Arlecchino extends Command {
  constructor(client: any) {
    super(client, 'arlecchino', 'scare leon away', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const gifsPath = path.join(import.meta.dir, '../data/arlecchino.json');
      const gifs = JSON.parse(fs.readFileSync(gifsPath, 'utf8'));
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      await interaction.editReply({ content: randomGif });
      await interaction.followUp({ content: '<@993614772354416673>' });
    } catch (error) {
      logError('Error fetching arlecchino GIF:', error);
      await interaction.editReply({ content: 'Sorry, I couldn\'t fetch a arlecchino GIF. Please try again later.', ephemeral: true });
    }
  }
}

export default Arlecchino;
