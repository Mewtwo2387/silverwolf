import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { flipCoin } from '../utils/flip';

const DESCRIPTIONS: Record<ReturnType<typeof flipCoin>, string> = {
  head: 'Silverwolf gave you head.',
  tail: 'Silverwolf gave you tail.',
  side: 'Silverwolf gave you side.',
};

class Flip extends Command {
  constructor(client: any) {
    super(client, 'flip', '50/50 for silverwolf to give you head', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const embed = new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle('You flipped a coin.')
      .setDescription(DESCRIPTIONS[flipCoin()]);
    interaction.editReply({ embeds: [embed] });
  }
}

export default Flip;
