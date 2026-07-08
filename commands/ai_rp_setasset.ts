import { AdminCommand } from './classes/AdminCommand';
import { ASSET_CHANNEL_KEY } from '../utils/rpAvatar';
import { logError } from '../utils/log';

/** Admin: choose the channel where roleplay character pfps are uploaded/hosted. */
class AiRpSetAsset extends AdminCommand {
  constructor(client: any) {
    super(client, 'rp-setasset', 'Set the channel where roleplay character avatars are hosted', [
      {
        name: 'channel',
        description: 'Channel to store character avatars in (bot needs send + embed perms there)',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel('channel');
    try {
      await this.client.db.serverConfig.setServerConfig(interaction.guild.id, ASSET_CHANNEL_KEY, channel.id);
      await interaction.editReply(
        `Roleplay asset channel set to <#${channel.id}>. New character avatars will be uploaded there — `
        + 'don\'t delete those messages or the avatars will break.',
      );
    } catch (err) {
      logError('AiRpSetAsset error:', err);
      await interaction.editReply('Failed to set the asset channel. Please try again.');
    }
  }
}

export default AiRpSetAsset;
