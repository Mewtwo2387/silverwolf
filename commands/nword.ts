import { Command } from './classes/Command';
import wordlist from '../data/words_dictionary.json';

class NWord extends Command {
  constructor(client: any) {
    super(client, 'nword', 'say an n-word', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const nwords = Object.keys(wordlist).filter((word) => word.startsWith('n'));
    const nword = nwords[Math.floor(Math.random() * nwords.length)];
    await interaction.editReply(nword);
  }
}

export default NWord;
