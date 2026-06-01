import { Command } from './classes/Command';
import {
  loadDeckCompositionForUser,
  saveDeckCompositionForUser,
  formatDeckComposition,
} from '../tcg/deckStorage';
import {
  ITEM_DISCORD_CHOICES,
  ITEMS_BY_ID,
  PER_CARD_MAX,
  DECK_MAX_FIVE_STAR_OR_ABOVE,
  DECK_MAX_FOUR_STAR_OR_ABOVE,
  validateDeckComposition,
} from '../tcg/items';
import { DECK_SIZE } from '../tcg/battle';

class TcgbattleDeckset extends Command {
  constructor(client: any) {
    super(client, 'deckset', 'Set how many copies of an item are in your deck', [
      {
        name: 'item',
        description: 'Which item to adjust',
        type: 3,
        required: true,
        choices: ITEM_DISCORD_CHOICES,
      },
      {
        name: 'count',
        description: `Copies (0–${PER_CARD_MAX}). Deck: ${DECK_SIZE} cards, max ${DECK_MAX_FIVE_STAR_OR_ABOVE} at 5★+, max ${DECK_MAX_FOUR_STAR_OR_ABOVE} at 4★+.`,
        type: 4,
        required: true,
        min_value: 0,
        max_value: PER_CARD_MAX,
      },
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const itemId = interaction.options.getString('item', true);
    const count = interaction.options.getInteger('count', true);
    const item = ITEMS_BY_ID[itemId];
    if (!item) {
      await interaction.editReply(`Unknown item: ${itemId}`);
      return;
    }

    const composition = await loadDeckCompositionForUser(this.client.db, interaction.user.id);
    const previous = composition[itemId] ?? 0;
    composition[itemId] = count;

    const validation = validateDeckComposition(composition);
    if (!validation.ok) {
      const text = formatDeckComposition(composition);
      await interaction.editReply([
        `Did not save: ${validation.reason}`,
        '',
        text,
        '',
        `_Tip: previous count for **${item.name}** was ${previous}._`,
      ].join('\n').slice(0, 1900));
      return;
    }

    await saveDeckCompositionForUser(this.client.db, interaction.user.id, composition);
    const text = formatDeckComposition(composition);
    await interaction.editReply([
      `Saved: **${item.name}** is now ${count}× in your deck (was ${previous}×).`,
      '',
      text,
    ].join('\n').slice(0, 1900));
  }
}

export default TcgbattleDeckset;
