import { Command } from './classes/Command';
import {
  setPending,
  channelHasTcgbattleActivity,
  type DiscordBattlePending,
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

class TcgbattleStart extends Command {
  constructor(client: any) {
    super(client, 'start', 'Challenge someone (or yourself) as P2: your team of 3, then accept with P2’s team', [
      {
        name: 'opponent',
        description: 'Who plays as P2 (pick yourself for solo / both sides)',
        type: 6,
        required: true,
      },
      teamSlot('card1', 'First character on your team'),
      teamSlot('card2', 'Second character on your team'),
      teamSlot('card3', 'Third character on your team'),
    ], { isSubcommandOf: 'tcgbattle', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channelId = interaction.channelId;
    const opponent = interaction.options.getUser('opponent');
    if (!opponent) {
      await interaction.editReply('Could not resolve opponent.');
      return;
    }
    if (channelHasTcgbattleActivity(channelId)) {
      await interaction.editReply('A TCG challenge or battle is already active in this channel. Use `/tcgbattle cancel` first.');
      return;
    }

    const c1 = interaction.options.getString('card1', true);
    const c2 = interaction.options.getString('card2', true);
    const c3 = interaction.options.getString('card3', true);
    const team = buildTeamOfThree(c1, c2, c3);
    if (!team) {
      await interaction.editReply('Invalid character choice; try again.');
      return;
    }

    const pending: DiscordBattlePending = {
      p1UserId: interaction.user.id,
      p2UserId: opponent.id,
      p1Tag: interaction.user.username,
      p2Tag: opponent.username,
      p1Team: team,
    };
    setPending(channelId, pending);

    const solo = opponent.id === interaction.user.id;
    const lines = solo
      ? [
        `${interaction.user} is playing **both P1 and P2** (solo).`,
        `**P1 team:** ${formatTeamNames(team)}`,
        '',
        'Run `/tcgbattle accept` and pick your **P2** team of three to begin.',
        'You can `/tcgbattle cancel` before the battle starts.',
      ]
      : [
        `${interaction.user} (**P1**) challenged ${opponent} (**P2**).`,
        `**P1 team:** ${formatTeamNames(team)}`,
        '',
        `${opponent}, run \`/tcgbattle accept\` and choose **your** team of three to begin.`,
        'Either player can `/tcgbattle cancel` before the battle starts.',
      ];
    await interaction.editReply(lines.join('\n'));
  }
}

export default TcgbattleStart;
