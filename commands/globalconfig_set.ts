import { DevCommand } from './classes/DevCommand';

class GlobalConfigSet extends DevCommand {
  constructor(client: any) {
    super(client, 'set', 'Set a global config value', [
      {
        name: 'key',
        description: 'config key',
        type: 3,
        required: true,
      },
      {
        name: 'value',
        description: 'config value',
        type: 3,
        required: true,
      },
    ], { isSubcommandOf: 'globalconfig', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');
    await this.client.db.globalConfig.setGlobalConfig(key, value);
    await interaction.editReply(`${key} set to ${value}`);
  }
}

export default GlobalConfigSet;
