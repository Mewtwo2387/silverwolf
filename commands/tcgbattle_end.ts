import { Command } from './classes/Command';
import { BattleStatus } from '../tcg/battle';
import { endTurnAsCurrentPlayer } from '../tcg/battleInterface';
import {
  getSession,
  getPending,
  clearSession,
  battleDisplayPayload,
  editReplyPlain,
  statusLine,
  sideForUser,
  sideForPendingUser,
  pendingChallengeHint,
} from '../tcg/discordBattle';

class TcgbattleEnd extends Command {
  constructor(client: any) {
    super(client, 'end', 'End your turn (pass to the other player)', [], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    const pending = getPending(channelId);
    if (!session && pending) {
      if (!sideForPendingUser(pending, interaction.user.id)) {
        await interaction.editReply('Only the two players in this matchup can end a turn.');
        return;
      }
      await interaction.editReply(pendingChallengeHint(pending));
      return;
    }
    if (!session) {
      await interaction.editReply('No TCG battle in this channel.');
      return;
    }
    const side = sideForUser(session, interaction.user.id);
    if (!side) {
      await interaction.editReply('Only the two players in this battle can end a turn.');
      return;
    }

    const { battle } = session;
    const et = endTurnAsCurrentPlayer(battle, side);
    if (!et.ok) {
      if (battle.status !== BattleStatus.Ongoing) {
        clearSession(channelId);
        await editReplyPlain(interaction, `This battle is already over (**${battle.status}**).`);
        return;
      }
      await editReplyPlain(interaction, `It is **${battle.currentPlayer.toUpperCase()}**'s turn right now.`);
      return;
    }

    if (battle.status !== BattleStatus.Ongoing) {
      const payload = await battleDisplayPayload(
        session,
        `**Battle ended — ${battle.status}**\n\n${statusLine(session)}`,
        { title: 'Battle ended', color: 0x95a5a6 },
      );
      clearSession(channelId);
      await interaction.editReply(payload);
      return;
    }

    const payload = await battleDisplayPayload(
      session,
      `Turn ended.\n${statusLine(session)}`,
      { title: 'TCG battle' },
    );
    await interaction.editReply(payload);
  }
}

export default TcgbattleEnd;
