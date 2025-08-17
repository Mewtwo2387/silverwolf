const { CommandGroup } = require('../classes/commandGroup');

class Sex extends CommandGroup {
  constructor(client) {
    super(client, 'sex', 'Sex commands', ['start', 'thrust', 'status']);
  }
}

module.exports = Sex;
