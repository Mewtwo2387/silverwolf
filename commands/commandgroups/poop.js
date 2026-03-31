const { CommandGroup } = require('../classes/commandGroup');

class Poop extends CommandGroup {
  constructor(client) {
    super(client, 'poop', 'April Fools poop tracker 💩', ['profile-create', 'log', 'stats']);
  }
}

module.exports = Poop;
