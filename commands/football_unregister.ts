import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { FOOTBALL_CHANNELS_CONFIG_KEY } from '../utils/footballChannels';
import { parseChannelIds } from '../utils/parseChannelIds';

class FootballUnregister extends DevCommand {
  constructor(client: any) {
    super(client, 'unregister', 'Unregister a channel from World Cup match announcements', [
      {
        name: 'channel',
        description: 'The channel to stop sending World Cup announcements to',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'football', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const existing = await this.client.db.globalConfig.getGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY);
    const channels = parseChannelIds(existing);

    if (!channels.includes(channel.id)) {
      await interaction.editReply(`<#${channel.id}> is not a World Cup announcement channel.`);
      return;
    }

    const updated = channels.filter((id: string) => id !== channel.id);
    await this.client.db.globalConfig.setGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY, updated.join(','));
    log(`Unregistered football channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Unregistered <#${channel.id}> from World Cup announcements.`);
  }
}

export default FootballUnregister;
