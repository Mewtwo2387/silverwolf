import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { FOOTBALL_CHANNELS_CONFIG_KEY } from '../utils/footballChannels';

class FootballRegister extends DevCommand {
  constructor(client: any) {
    super(client, 'register', 'Register a channel for World Cup match announcements', [
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

    const added = await this.client.db.globalConfig.appendUniqueToList(
      FOOTBALL_CHANNELS_CONFIG_KEY,
      channel.id,
    );

    if (!added) {
      await interaction.editReply(`<#${channel.id}> is already a World Cup announcement channel.`);
      return;
    }

    log(`Registered football channel ${channel.name} (${channel.id})`);
    await interaction.editReply(`Registered <#${channel.id}> for World Cup announcements.`);
  }
}

export default FootballRegister;
