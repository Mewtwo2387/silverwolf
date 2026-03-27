const { CommandGroup } = require('../classes/commandGroup');

class Card extends CommandGroup {
  constructor(client) {
    super(client, 'card', 'TCG card commands', ['custom', 'show']);
  }
}

module.exports = Card;
