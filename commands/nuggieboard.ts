import { Command } from './classes/Command';
import LeaderboardMixin from './mixins/leaderboardMixin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class NuggieBoard extends (LeaderboardMixin(Command) as any) {
  constructor(client: any) {
    super(
      client,
      'nuggieboard',
      'dinonuggie leaderboard',
      'Dinonuggie Leaderboard',
      'dinonuggies',
      'Nuggies',
      'No one have any nuggies yet!',
    );
  }
}

export default NuggieBoard;
