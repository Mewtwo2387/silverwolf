const { CommandGroup } = require('../classes/commandGroup');

class Summary extends CommandGroup {
  constructor(client) {
    super(client, 'summary', 'Summary commands', ['count', 'time']);
  }
}

module.exports = Summary;
