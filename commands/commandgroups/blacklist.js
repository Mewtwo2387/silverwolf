const { CommandGroup } = require('../classes/commandGroup');

class Blacklist extends CommandGroup {
  constructor(client) {
    super(client, 'blacklist', 'Blacklist commands', ['configure', 'view']);
  }
}

module.exports = Blacklist;
