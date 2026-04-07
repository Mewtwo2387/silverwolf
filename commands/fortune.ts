import * as fs from 'fs';
import * as path from 'path';
import { Command } from './classes/Command';

class Fortune extends Command {
  constructor(client: any) {
    super(client, 'fortune', 'how desperate are you to munch virtual fortune cookies ?', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const filePath = path.join(import.meta.dir, '../data/fortune.json');
    const data = fs.readFileSync(filePath);
    const { fortunes } = JSON.parse(data.toString());

    const randomIndex = Math.floor(Math.random() * fortunes.length);
    const fortune = fortunes[randomIndex];

    await interaction.editReply(`🥠 Your fortune: "${fortune}"`);
  }
}

export default Fortune;
