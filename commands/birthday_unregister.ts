import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { parseChannelIds } from '../utils/parseChannelIds';

const BIRTHDAY_CHANNELS_CONFIG_KEY = 'birthday_channels';

class BirthdayUnregister extends DevCommand {
  constructor(client: any) {
    super(client, 'unregister', 'Unregister a channel from birthday announcements', [
      {
        name: 'channel',
        description: 'The channel to stop sending birthday messages to',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'birthday', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const existing = await this.client.db.globalConfig.getGlobalConfig(BIRTHDAY_CHANNELS_CONFIG_KEY);
    const channels = parseChannelIds(existing);

    if (!channels.includes(channel.id)) {
      await interaction.editReply(`<#${channel.id}> is not a birthday announcement channel.`);
      return;
    }

    const updated = channels.filter((id: string) => id !== channel.id);
    // Persist explicit empty string so env fallback does not re-enable removed channels.
    await this.client.db.globalConfig.setGlobalConfig(BIRTHDAY_CHANNELS_CONFIG_KEY, updated.join(','));
    log(`Unregistered birthday channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Unregistered <#${channel.id}> from birthday announcements.`);
  }
}

export default BirthdayUnregister;
