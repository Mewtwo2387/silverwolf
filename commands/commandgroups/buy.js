const { CommandGroup } = require('../classes/commandGroup.js');

class Buy extends CommandGroup {
  constructor(client) {
    super(client, 'buy', 'Buy commands', ['upgrades', 'ascension', 'donation']);
  }
}

module.exports = Buy;
