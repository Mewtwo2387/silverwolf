import { Command } from './classes/Command';
import { Battle } from '../tcg/battle';
import {
  setSession,
  getSession,
  getPending,
  battleDisplayPayload,
  statusLine,
  type DiscordBattleSession,
} from '../tcg/discordBattle';
import {
  buildTeamOfThree,
  formatTeamNames,
  CHARACTER_ROSTER_DISCORD_CHOICES,
} from '../tcg/characterRoster';

const teamSlot = (name: string, label: string) => ({
  name,
  description: label,
  type: 3,
  required: true,
  choices: CHARACTER_ROSTER_DISCORD_CHOICES,
});

class TcgbattleAccept extends Command {
  constructor(client: any) {
    super(client, 'accept', 'Accept a TCG challenge and lock in your team of 3', [
      teamSlot('card1', 'First character on your team'),
      teamSlot('card2', 'Second character on your team'),
      teamSlot('card3', 'Third character on your team'),
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const pending = getPending(channelId);
    if (!pending) {
      await interaction.editReply(
        getSession(channelId)
          ? 'A battle is already in progress in this channel.'
          : 'No open TCG challenge here. Ask P1 to use `/tcgbattle start` first.',
      );
      return;
    }
    if (interaction.user.id !== pending.p2UserId) {
      await interaction.editReply(
        `Only the invited player (<@${pending.p2UserId}>) can accept this challenge.`,
      );
      return;
    }

    const c1 = interaction.options.getString('card1', true);
    const c2 = interaction.options.getString('card2', true);
    const c3 = interaction.options.getString('card3', true);
    const p2Team = buildTeamOfThree(c1, c2, c3);
    if (!p2Team) {
      await interaction.editReply('Invalid character choice; try again.');
      return;
    }

    const battle = new Battle(pending.p1Team, p2Team);
    const session: DiscordBattleSession = {
      battle,
      p1UserId: pending.p1UserId,
      p2UserId: pending.p2UserId,
      p1Tag: pending.p1Tag,
      p2Tag: pending.p2Tag,
    };
    setSession(channelId, session);

    const description = [
      `**P1** ${pending.p1Tag} — ${formatTeamNames(pending.p1Team)}`,
      `**P2** ${pending.p2Tag} — ${formatTeamNames(p2Team)}`,
      '',
      statusLine(session),
      '',
      '**Commands:** `status` · `use` · `end` · `cancel`',
      'Each character can use one skill per turn; `/tcgbattle end` ends your turn when you are done.',
    ].join('\n');
    const payload = await battleDisplayPayload(session, description);
    await interaction.editReply(payload);
  }
}

export default TcgbattleAccept;
