import { DevCommand } from './classes/DevCommand';
import { debugMaxEnergy } from '../tcg/battleInterface';
import {
  getSession,
  getPending,
  battleDisplayPayload,
  statusLine,
  sideForUser,
  sideForPendingUser,
  pendingChallengeHint,
} from '../tcg/discordBattle';

class TcgbattleDebug extends DevCommand {
  constructor(client: any) {
    super(client, 'debug', '[dev] Give every character 9999 energy', [], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    const pending = getPending(channelId);
    if (!session && pending) {
      if (!sideForPendingUser(pending, interaction.user.id)) {
        await interaction.editReply('Only one of the two players can use this.');
        return;
      }
      await interaction.editReply(pendingChallengeHint(pending));
      return;
    }
    if (!session) {
      await interaction.editReply('No TCG battle in this channel.');
      return;
    }
    if (!sideForUser(session, interaction.user.id)) {
      await interaction.editReply('Only one of the two players can use this.');
      return;
    }

    debugMaxEnergy(session.battle);

    const payload = await battleDisplayPayload(
      session,
      `Everyone gained energy.\n${statusLine(session)}`,
      { title: 'TCG battle' },
    );
    await interaction.editReply(payload);
  }
}

export default TcgbattleDebug;
