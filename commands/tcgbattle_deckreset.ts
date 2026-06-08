import { Command } from './classes/Command';
import { saveDeckCompositionForUser, formatDeckComposition } from '../tcg/deckStorage';
import { defaultDeckComposition } from '../tcg/items';

class TcgbattleDeckreset extends Command {
  constructor(client: any) {
    super(client, 'deckreset', 'Reset your item deck to the default 25-card composition', [
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const composition = defaultDeckComposition();
    await saveDeckCompositionForUser(this.client.db, interaction.user.id, composition);
    const text = formatDeckComposition(composition);
    await interaction.editReply([
      'Deck reset to default.',
      '',
      text,
    ].join('\n').slice(0, 1900));
  }
}

export default TcgbattleDeckreset;
