const { CommandGroup } = require('../classes/commandGroup.js');

class Birthday extends CommandGroup {
  constructor(client) {
    super(client, 'birthday', 'Birthday commands', ['get', 'set', 'test']);
  }
}

module.exports = Birthday;
