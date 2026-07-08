import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';

class BirthdayRegister extends DevCommand {
  constructor(client: any) {
    super(client, 'register', 'Register a channel for birthday announcements', [
      {
        name: 'channel',
        description: 'The channel to send birthday messages to',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'birthday', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const added = await this.client.db.globalConfig.appendUniqueToList('birthday_channels', channel.id);

    if (!added) {
      await interaction.editReply(`<#${channel.id}> is already a birthday announcement channel.`);
      return;
    }

    log(`Registered birthday channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Registered <#${channel.id}> for birthday announcements.`);
  }
}

export default BirthdayRegister;
