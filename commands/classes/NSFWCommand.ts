import { Command, CommandArgs } from './Command';
import { log } from '../../utils/log';
import { isBasement } from '../../utils/accessControl';

class NsfwCommand extends Command {
  constructor(client: any, name: string, description: string, options: any[], args: CommandArgs = {}) {
    super(client, name, description, options, args);
  }

  async execute(interaction: any): Promise<void> {
    if (!isBasement(interaction)) {
      log(`${interaction.user.username} tried using an nsfw command in ${interaction.guild.name} smh`);
      if (interaction.deferred) {
        await interaction.editReply('NSFW commands are not enabled in this server.');
      } else {
        await interaction.reply('NSFW commands are not enabled in this server.');
      }
      return;
    }
    await super.execute(interaction);
  }
}

export { NsfwCommand };
