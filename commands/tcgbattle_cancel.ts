import { Command } from './classes/Command';
import {
  getSession,
  getPending,
  clearChannelTcgbattleState,
  editReplyPlain,
  sideForUser,
  sideForPendingUser,
} from '../tcg/discordBattle';

class TcgbattleCancel extends Command {
  constructor(client: any) {
    super(client, 'cancel', 'Cancel an open challenge or abandon the battle in this channel', [], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    const pending = getPending(channelId);
    if (!session && !pending) {
      await interaction.editReply('No TCG battle or open challenge in this channel.');
      return;
    }
    if (session) {
      if (!sideForUser(session, interaction.user.id)) {
        await interaction.editReply('Only one of the two players can cancel this battle.');
        return;
      }
    } else if (pending && !sideForPendingUser(pending, interaction.user.id)) {
      await interaction.editReply('Only one of the two players can cancel this challenge.');
      return;
    }

    clearChannelTcgbattleState(channelId);
    await editReplyPlain(interaction, session ? 'TCG battle cancelled.' : 'TCG challenge cancelled.');
  }
}

export default TcgbattleCancel;
