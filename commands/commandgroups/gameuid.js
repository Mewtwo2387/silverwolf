const { CommandGroup } = require('../classes/commandGroup');

class GameUID extends CommandGroup {
  constructor(client) {
    super(client, 'gameuid', 'Game UID commands', ['set', 'get', 'delete']);
  }
}

module.exports = GameUID;
