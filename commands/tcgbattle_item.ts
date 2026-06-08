import { Command } from './classes/Command';
import { BattleStatus } from '../tcg/battle';
import {
  getSession,
  getPending,
  clearSession,
  tryUseItem,
  battleDisplayPayload,
  editReplyPlain,
  statusLine,
  sideForUser,
  sideForPendingUser,
  pendingChallengeHint,
} from '../tcg/discordBattle';

class TcgbattleItem extends Command {
  constructor(client: any) {
    super(client, 'item', 'Play an item card from your hand on one of your characters', [
      {
        name: 'hand',
        description: 'Hand slot id from /tcgbattle hand (stable; does not shift when you use a card)',
        type: 4,
        required: true,
        min_value: 0,
        max_value: 50,
      },
      {
        name: 'character',
        description: 'Your character slot index to apply the item to',
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

    const handIndex = interaction.options.getInteger('hand') ?? 0;
    const charIndex = interaction.options.getInteger('character') ?? 0;

    const result = tryUseItem(session, side, handIndex, charIndex);
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

export default TcgbattleItem;
