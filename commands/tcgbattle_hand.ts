import { Command } from './classes/Command';
import {
  getSession,
  handTextForSide,
  sideForUser,
} from '../tcg/discordBattle';

class TcgbattleHand extends Command {
  constructor(client: any) {
    super(client, 'hand', 'Show your item hand (only visible to you)', [
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    if (!session) {
      await interaction.editReply('No TCG battle in this channel.');
      return;
    }
    const side = sideForUser(session, interaction.user.id);
    if (!side) {
      await interaction.editReply('Only the two players in this battle can view a hand.');
      return;
    }
    const text = handTextForSide(session, side);
    await interaction.editReply(text.slice(0, 1900));
  }
}

export default TcgbattleHand;
