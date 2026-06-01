import { Command } from './classes/Command';
import { loadDeckCompositionForUser, formatDeckComposition } from '../tcg/deckStorage';

class TcgbattleDeck extends Command {
  constructor(client: any) {
    super(client, 'deck', 'Show your saved item deck (used at the start of every battle)', [
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const composition = await loadDeckCompositionForUser(this.client.db, interaction.user.id);
    const text = formatDeckComposition(composition);
    const help = [
      '',
      '_Edit with `/tcgbattle deckset item:<card> count:<n>`._',
      '_A legal deck has exactly 25 cards (max 10 of any single card)._',
    ].join('\n');
    await interaction.editReply(`${text}${help}`.slice(0, 1900));
  }
}

export default TcgbattleDeck;
