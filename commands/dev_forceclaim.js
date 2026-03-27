const { DevCommand } = require('./classes/devcommand');
const { handleSuccessfulClaim } = require('../utils/claim');

class ForceClaim extends DevCommand {
  constructor(client) {
    super(client, 'forceclaim', 'claim dinonuggies ignoring cooldown', [], { isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction) {
    await handleSuccessfulClaim(this.client, interaction);
  }
}

module.exports = ForceClaim;
