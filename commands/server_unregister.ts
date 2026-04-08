import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { clearCachedAllowedServers } from '../utils/accessControl';
import { REST, Routes } from 'discord.js';

class ServerUnregister extends DevCommand {
  constructor(client: any) {
    super(client, 'unregister', 'Unregister this server from bot commands', [], { isSubcommandOf: 'server', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    const existing = await this.client.db.globalConfig.getGlobalConfig('allowed_servers');
    const servers = existing ? existing.split(',') : [];

    if (!servers.includes(guildId)) {
      await interaction.editReply(`Server **${guildName}** (\`${guildId}\`) is not registered.`);
      return;
    }

    const updated = servers.filter((id: string) => id !== guildId);
    if (updated.length > 0) {
      await this.client.db.globalConfig.setGlobalConfig('allowed_servers', updated.join(','));
    } else {
      await this.client.db.globalConfig.deleteGlobalConfig('allowed_servers');
    }
    clearCachedAllowedServers();
    log(`Unregistered server ${guildName} (${guildId}) from allowed_servers`);

    // Clear guild-specific commands for this server
    const rest = new REST({ version: '10' }).setToken(this.client.token);
    await rest.put(Routes.applicationGuildCommands(this.client.user.id, guildId), { body: [] });

    await interaction.editReply(`Server **${guildName}** (\`${guildId}\`) unregistered and commands removed.`);

    // Re-register remaining servers (or go back to global /server only)
    await this.client.registerCommands(this.client.user.id);
  }
}

export default ServerUnregister;
