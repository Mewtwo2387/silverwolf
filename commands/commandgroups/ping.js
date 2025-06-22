const { CommandGroup } = require('../classes/commandGroup');

class Ping extends CommandGroup {
  constructor(client) {
    super(client, 'ping', 'pong', ['regular', 'dev']);
  }
}

module.exports = Ping;
