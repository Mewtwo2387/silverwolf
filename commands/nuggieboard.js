const { Command } = require('./classes/command.js');
const LeaderboardMixin = require('./mixins/leaderboardMixin.js');

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
