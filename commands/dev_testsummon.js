const { DevCommand } = require('./classes/devcommand');

const HOUR_LENGTH = 60 * 60 * 1000;
const MINUTE_LENGTH = 60 * 1000;

class DevTestSummon extends DevCommand {
  constructor(client) {
    super(client, 'testsummon', 'summon a pokemon at random intervals', [], { ephemeral: true, isSubcommandOf: 'dev' });
  }

  async run(interaction) {
    this.nextSummon(interaction);
  }

  async nextSummon(interaction) {
    const randomInterval = Math.floor(Math.random() * HOUR_LENGTH) + 20 * MINUTE_LENGTH;
    setTimeout(async () => {
      await this.client.summonPokemon(interaction);
      this.nextSummon(interaction);
    }, randomInterval);
  }
}

module.exports = DevTestSummon;
