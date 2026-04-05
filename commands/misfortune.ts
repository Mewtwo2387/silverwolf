import * as fs from 'fs';
import * as path from 'path';
import { Command } from './classes/Command';

class Misfortune extends Command {
  constructor(client: any) {
    super(client, 'misfortune', 'how bad is your day that you are munching virtual misfortune cookies ?', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const filePath = path.join(import.meta.dir, '../data/misfortune.json');
    const data = fs.readFileSync(filePath);
    const { misfortunes } = JSON.parse(data.toString());

    const randomIndex = Math.floor(Math.random() * misfortunes.length);
    const misfortune = misfortunes[randomIndex];

    await interaction.editReply(`🥠☠Your misfortune : "${misfortune}"`);
  }
}

export default Misfortune;
