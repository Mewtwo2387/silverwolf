import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { FOOTBALL_CHANNELS_CONFIG_KEY } from '../utils/footballChannels';

class FootballChannel extends DevCommand {
  constructor(client: any) {
    super(client, 'channel', 'Set a channel for World Cup match announcements', [
      {
        name: 'channel',
        description: 'The channel to send World Cup announcements to',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'football', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const existing = await this.client.db.globalConfig.getGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY);
    const channels = existing ? existing.split(',') : [];

    if (channels.includes(channel.id)) {
      const updated = channels.filter((id: string) => id !== channel.id);
      await this.client.db.globalConfig.setGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY, updated.join(','));
      log(`Removed football channel ${channel.name} (${channel.id})`);
      await interaction.editReply(`Removed <#${channel.id}> from football channels.`);
      return;
    }

    channels.push(channel.id);
    await this.client.db.globalConfig.setGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY, channels.join(','));
    log(`Added football channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Added <#${channel.id}> as a World Cup announcement channel.`);
  }
}

export default FootballChannel;
