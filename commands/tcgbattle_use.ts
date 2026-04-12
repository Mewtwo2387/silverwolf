import { Command } from './classes/Command';
import { BattleStatus } from '../tcg/battle';
import {
  getSession,
  getPending,
  clearSession,
  tryUseSkill,
  battleDisplayPayload,
  editReplyPlain,
  statusLine,
  sideForUser,
  sideForPendingUser,
  pendingChallengeHint,
} from '../tcg/discordBattle';

class TcgbattleUse extends Command {
  constructor(client: any) {
    super(client, 'use', 'Use a skill on your turn', [
      {
        name: 'character',
        description: 'Your character slot index',
        type: 4,
        required: true,
        min_value: 0,
        max_value: 10,
      },
      {
        name: 'skill',
        description: 'Skill index (see /tcgbattle status)',
        type: 4,
        required: true,
        min_value: 0,
        max_value: 20,
      },
      {
        name: 'target',
        description: 'Single-target: opponent or ally slot index, or self for ally-on-self. AoE / self skills: omit or 0',
        type: 3,
        required: false,
      },
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const session = getSession(channelId);
    const pending = getPending(channelId);
    if (!session && pending) {
      if (!sideForPendingUser(pending, interaction.user.id)) {
        await interaction.editReply('Only the two players in this matchup can act.');
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
      await interaction.editReply('Only the two players in this battle can act.');
      return;
    }

    const charIndex = interaction.options.getInteger('character') ?? 0;
    const skillIndex = interaction.options.getInteger('skill') ?? 0;
    const targetOpt = interaction.options.getString('target');

    const result = tryUseSkill(session, side, charIndex, skillIndex, targetOpt);
    if (!result.ok) {
      await editReplyPlain(interaction, result.error);
      return;
    }

    const ended = session.battle.status !== BattleStatus.Ongoing;
    const description = ended
      ? `**${result.message}**\n\n**Battle ended — ${session.battle.status}**\n\n${statusLine(session)}`
      : `${result.message}\n\n${statusLine(session)}`;
    if (ended) {
      clearSession(channelId);
    }
    const payload = await battleDisplayPayload(session, description, {
      title: ended ? 'Battle ended' : 'TCG battle',
      color: ended ? 0x95a5a6 : 0x5865f2,
    });
    await interaction.editReply(payload);
  }
}

export default TcgbattleUse;
