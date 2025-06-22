const { CommandGroup } = require('../classes/commandGroup');

class Shop extends CommandGroup {
  constructor(client) {
    super(client, 'shop', 'shop commands', ['ascension', 'upgrades', 'upgradesdata', 'donation']);
  }
}

module.exports = Shop;
