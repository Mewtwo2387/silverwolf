const { CommandGroup } = require('../classes/commandGroup');

class Dev extends CommandGroup {
  constructor(client) {
    super(client, 'dev', 'Developer commands', ['add', 'set', 'forcesummon', 'testsummon', 'forceclaim']);
  }
}

module.exports = Dev;
