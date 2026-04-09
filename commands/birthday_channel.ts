import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';

class BirthdayChannel extends DevCommand {
  constructor(client: any) {
    super(client, 'channel', 'Set a channel for birthday announcements', [
      {
        name: 'channel',
        description: 'The channel to send birthday messages to',
        type: 7, // CHANNEL type
        required: true,
        channel_types: [0], // GUILD_TEXT only
      },
    ], { isSubcommandOf: 'birthday', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const existing = await this.client.db.globalConfig.getGlobalConfig('birthday_channels');
    const channels = existing ? existing.split(',') : [];

    if (channels.includes(channel.id)) {
      // Remove it (toggle behavior) — always persist explicit value (even empty string)
      const updated = channels.filter((id: string) => id !== channel.id);
      await this.client.db.globalConfig.setGlobalConfig('birthday_channels', updated.join(','));
      log(`Removed birthday channel ${channel.name} (${channel.id})`);
      await interaction.editReply(`Removed <#${channel.id}> from birthday channels.`);
      return;
    }

    channels.push(channel.id);
    await this.client.db.globalConfig.setGlobalConfig('birthday_channels', channels.join(','));
    log(`Added birthday channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Added <#${channel.id}> as a birthday announcement channel.`);
  }
}

export default BirthdayChannel;
