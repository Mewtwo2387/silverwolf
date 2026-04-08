import { DevCommand } from './classes/DevCommand';
import { log } from '../utils/log';
import { clearCachedAllowedServers } from '../utils/accessControl';

class ServerRegister extends DevCommand {
  constructor(client: any) {
    super(client, 'register', 'Register this server for bot commands', [], { isSubcommandOf: 'server', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    const existing = await this.client.db.globalConfig.getGlobalConfig('allowed_servers');
    const servers = existing ? existing.split(',') : [];

    if (servers.includes(guildId)) {
      await interaction.editReply(`Server **${guildName}** (\`${guildId}\`) is already registered.`);
      return;
    }

    servers.push(guildId);
    await this.client.db.globalConfig.setGlobalConfig('allowed_servers', servers.join(','));
    clearCachedAllowedServers();
    log(`Registered server ${guildName} (${guildId}) to allowed_servers`);

    await interaction.editReply(`Server **${guildName}** (\`${guildId}\`) registered. Re-registering commands...`);

    // Re-register commands so the guild gets its commands immediately
    await this.client.registerCommands(this.client.user.id);
    await interaction.followUp(`Commands registered for **${guildName}**.`);
  }
}

export default ServerRegister;
