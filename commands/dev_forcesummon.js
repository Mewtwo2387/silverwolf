const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');

class ForceSummon extends DevCommand {
  constructor(client) {
    super(client, 'forcesummon', 'force summon a pokemon', [
      {
        name: 'mode',
        description: 'mode',
        type: 3,
        required: false,
        choices: [
          { name: 'normal', value: 'normal' },
          { name: 'shiny', value: 'shiny' },
          { name: 'mystery', value: 'mystery' },
        ],
      },
    ], { ephemeral: true, isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction) {
    try {
      const mode = interaction.options.getString('mode') || 'normal';
      const handler = await this.client.getHandler(); // Get the current seasonal handler
      await handler.summonPokemon(interaction, mode); // Use handler's summonPokemon with the specified mode
    } catch (error) {
      logError('Error executing command forcesummon:', error);
      interaction.editReply('There was an error summoning the Pokémon.');
    }
  }
}

module.exports = ForceSummon;
