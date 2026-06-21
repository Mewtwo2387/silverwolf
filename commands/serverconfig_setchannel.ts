import { DevCommand } from './classes/DevCommand';
import { isServerChannelListKey } from '../utils/serverConfig';

class ServerConfigSetChannel extends DevCommand {
  constructor(client: any) {
    super(client, 'setchannel', 'Set or toggle a channel config for this server', [
      {
        name: 'key',
        description: 'Config key (e.g. serious_channels, or a custom name for a single channel)',
        type: 3,
        required: true,
      },
      {
        name: 'channel',
        description: 'The Discord channel',
        type: 7,
        required: true,
        channel_types: [0],
      },
    ], { isSubcommandOf: 'serverconfig', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    if (!interaction.guild) {
      await interaction.editReply('This command must be used in a server.');
      return;
    }

    const key = interaction.options.getString('key').trim();
    const channel = interaction.options.getChannel('channel');
    const serverId = interaction.guild.id;

    if (!key) {
      await interaction.editReply('Key cannot be empty.');
      return;
    }

    if (isServerChannelListKey(key)) {
      const added = await this.client.db.serverConfig.appendUniqueToList(serverId, key, channel.id);

      if (added) {
        await interaction.editReply(`Added <#${channel.id}> to \`${key}\`.`);
        return;
      }

      const removed = await this.client.db.serverConfig.removeFromList(serverId, key, channel.id);
      if (removed) {
        await interaction.editReply(`Removed <#${channel.id}> from \`${key}\`.`);
        return;
      }

      await interaction.editReply(`<#${channel.id}> is not in \`${key}\`.`);
      return;
    }

    await this.client.db.serverConfig.setServerChannel(serverId, key, channel.id);
    await interaction.editReply(`\`${key}\` set to <#${channel.id}> for **${interaction.guild.name}**.`);
  }
}

export default ServerConfigSetChannel;
