import { Command } from './classes/Command';
import LeaderboardMixin from './mixins/leaderboardMixin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class MurderBoard extends (LeaderboardMixin(Command) as any) {
  constructor(client: any) {
    super(
      client,
      'murderboard',
      'criminal records',
      'Murder Leaderboard',
      'murderSuccess',
      'Successful Murders',
      'No successful murders yet!',
    );
  }
}

export default MurderBoard;
