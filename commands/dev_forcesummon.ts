import { DevCommand } from './classes/DevCommand';
import { logError } from '../utils/log';
import { loadResolvedServerConfig } from '../utils/serverConfig';

class ForceSummon extends DevCommand {
  constructor(client: any) {
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

  async run(interaction: any): Promise<void> {
    try {
      const mode = interaction.options.getString('mode') || 'normal';
      const handler = await this.client.getHandler();
      const guildConfig = interaction.guild
        ? await loadResolvedServerConfig(this.client.db, interaction.guild.id)
        : undefined;
      await handler.summonPokemon(interaction, mode, guildConfig);
    } catch (error) {
      logError('Error executing command forcesummon:', error);
      interaction.editReply('There was an error summoning the Pokémon.');
    }
  }
}

export default ForceSummon;
