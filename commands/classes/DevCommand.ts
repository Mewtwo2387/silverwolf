import { Command } from './Command';
import { log } from '../../utils/log';
import { isDev } from '../../utils/accessControl';

class DevCommand extends Command {
  constructor(client: any, name: string, description: string, options: any[], args = { ephemeral: false, skipDefer: false, isSubcommandOf: null as string | null }) {
    super(client, name, description, options, args);
  }

  async execute(interaction: any): Promise<void> {
    if (!isDev(interaction)) {
      log(`${interaction.user.username} tried using a dev command smh`);
      if (interaction.deferred) {
        await interaction.editReply('No.');
      } else {
        await interaction.reply('No.');
      }
      return;
    }
    super.execute(interaction);
  }
}

export { DevCommand };
