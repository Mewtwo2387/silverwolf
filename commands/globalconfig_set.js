const { DevCommand } = require('./classes/devcommand');

class GlobalConfigSet extends DevCommand {
  constructor(client) {
    super(client, 'set', 'Set a global config value', [
      {
        name: 'key',
        description: 'config key',
        type: 3, // String type
        required: true,
      },
      {
        name: 'value',
        description: 'config value',
        type: 3, // String type
        required: true,
      },
    ], { isSubcommandOf: 'globalconfig' });
  }

  async run(interaction) {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');
    await this.client.db.globalConfig.setGlobalConfig(key, value);
    await interaction.editReply(`${key} set to ${value}`);
  }
}

module.exports = GlobalConfigSet;
