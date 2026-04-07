import { Command, CommandArgs } from './Command';
import { log } from '../../utils/log';
import { isAdmin } from '../../utils/accessControl';

class AdminCommand extends Command {
  constructor(client: any, name: string, description: string, options: any[], args: CommandArgs = {}) {
    super(client, name, description, options, args);
  }

  async execute(interaction: any): Promise<void> {
    if (!isAdmin(interaction)) {
      log(`${interaction.user.username} tried using an admin command smh`);
      if (interaction.deferred) {
        await interaction.editReply('You do not have permission to use this command.');
      } else {
        await interaction.reply('You do not have permission to use this command.');
      }
      return;
    }
    await super.execute(interaction);
  }
}

export { AdminCommand };
