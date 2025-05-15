const { CommandGroup } = require('../classes/commandGroup');

class RussianRoulette extends CommandGroup {
  constructor(client) {
    super(client, 'russianroulette', 'Russian Roulette commands', ['regular', 'singleplayer']);
  }
}

module.exports = RussianRoulette;
