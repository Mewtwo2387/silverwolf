import path from 'path';
import { Command } from './classes/Command';

let nwordsCache: string[] | null = null;

async function getNwords(): Promise<string[]> {
  if (!nwordsCache) {
    nwordsCache = await Bun.file(path.join(__dirname, '../data/nwords.json')).json();
  }
  return nwordsCache!;
}

class NWord extends Command {
  constructor(client: any) {
    super(client, 'nword', 'say an n-word', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const nwords = await getNwords();
    const nword = nwords[Math.floor(Math.random() * nwords.length)];
    await interaction.editReply(nword);
  }
}

export default NWord;
