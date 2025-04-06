const { CommandGroup } = require('../classes/commandGroup.js');

class Sex extends CommandGroup {
  constructor(client) {
    super(client, 'sex', 'Sex commands', ['start', 'thrust', 'status']);
  }
}

module.exports = Sex;
