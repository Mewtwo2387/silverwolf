import { Command } from './classes/Command';
import fortuneData from '../data/fortune.json';

class Fortune extends Command {
  constructor(client: any) {
    super(client, 'fortune', 'how desperate are you to munch virtual fortune cookies ?', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const { fortunes } = fortuneData;

    const randomIndex = Math.floor(Math.random() * fortunes.length);
    const fortune = fortunes[randomIndex];

    await interaction.editReply(`🥠 Your fortune: "${fortune}"`);
  }
}

export default Fortune;
