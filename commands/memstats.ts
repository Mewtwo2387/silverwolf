import { DevCommand } from './classes/DevCommand';
import { collectMemStats } from '../utils/memStats';
import { logError } from '../utils/log';

/**
 * Dev diagnostic: reports process memory, discord.js cache sizes, roleplay
 * in-memory state, and DB footprint. Run it periodically while the bot grows to
 * see WHERE the memory lives (JS heap vs native, which cache). The `gc` option
 * forces a full GC first — if rss drops a lot, it's heap high-water/lazy GC
 * rather than a true leak.
 */
class MemStats extends DevCommand {
  constructor(client: any) {
    super(client, 'memstats', 'Show process memory and cache diagnostics.', [
      {
        name: 'gc',
        description: 'Force a full garbage collection before measuring',
        type: 5,
        required: false,
      },
    ], { blame: 'user', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    try {
      const report = await collectMemStats(this.client, interaction.options.getBoolean('gc') ?? false);
      await interaction.editReply({ content: report });
    } catch (error) {
      logError('memstats failed:', error);
      await interaction.editReply({ content: 'Failed to collect memory stats.' });
    }
  }
}

export default MemStats;
