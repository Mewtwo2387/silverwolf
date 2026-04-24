import { Command } from './classes/Command';
import {
  getSession,
  getPending,
  battleDisplayPayload,
  formatAllyStatusText,
  statusLine,
  sideForUser,
  sideForPendingUser,
  pendingChallengeHint,
} from '../tcg/discordBattle';

class TcgbattleStatus extends Command {
  constructor(client: any) {
    super(client, 'status', 'Show one ally’s skills, stats, and current effects', [
      {
        name: 'id',
        description: 'Your ally character slot index (0, 1, …)',
        type: 4,
        required: true,
        min_value: 0,
        max_value: 10,
      },
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    const pending = getPending(channelId);
    if (!session && pending) {
      if (!sideForPendingUser(pending, interaction.user.id)) {
        await interaction.editReply('Only the two players in this matchup can use this.');
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
      await interaction.editReply('Only the two players in this battle can view ally status.');
      return;
    }

    const charId = interaction.options.getInteger('id') ?? 0;
    const statusBlock = formatAllyStatusText(session, side, charId);
    const description = `${statusBlock}\n\n${statusLine(session)}`.slice(0, 4096);
    const payload = await battleDisplayPayload(session, description, { title: 'Ally status' });
    await interaction.editReply(payload);
  }
}

export default TcgbattleStatus;
