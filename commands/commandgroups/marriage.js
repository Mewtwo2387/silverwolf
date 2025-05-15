const { CommandGroup } = require('../classes/commandGroup');

class Marriage extends CommandGroup {
  constructor(client) {
    super(client, 'marriage', 'Marriage commands', ['divorce', 'propose', 'status']);
  }
}

module.exports = Marriage;
