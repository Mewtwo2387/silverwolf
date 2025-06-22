const { Command } = require('./classes/command');
const LeaderboardMixin = require('./mixins/leaderboardMixin');

class NuggieBoard extends LeaderboardMixin(Command) {
  constructor(client) {
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

module.exports = NuggieBoard;
