import { Command } from './classes/Command';
import misfortuneData from '../data/misfortune.json';

class Misfortune extends Command {
  constructor(client: any) {
    super(client, 'misfortune', 'how bad is your day that you are munching virtual misfortune cookies ?', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const { misfortunes } = misfortuneData;

    const randomIndex = Math.floor(Math.random() * misfortunes.length);
    const misfortune = misfortunes[randomIndex];

    await interaction.editReply(`🥠☠Your misfortune : "${misfortune}"`);
  }
}

export default Misfortune;
