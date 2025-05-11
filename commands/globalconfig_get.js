const { EmbedBuilder } = require('discord.js');
const { DevCommand } = require('./classes/devcommand');

class GlobalConfigGet extends DevCommand {
  constructor(client) {
    super(client, 'get', 'Get a global config value', [
      {
        name: 'key',
        description: 'config key (ALL to get all)',
        type: 3, // String type
        required: true,
      },
    ], { isSubcommandOf: 'globalconfig' });
  }

  async run(interaction) {
    const key = interaction.options.getString('key');
    if (key === 'ALL') {
      const all = await this.client.db.getAllGlobalConfig();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('All Global Config Values')
            .setDescription(all.map((row) => `**${row.key}**: ${row.value}`).join('\n'))
            .setColor('#00AA00'),
        ],
      });
    } else {
      const value = await this.client.db.getGlobalConfig(key);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Global Config: ${key}`)
            .setDescription(`Value: ${value}`)
            .setColor('#00AA00'),
        ],
      });
    }
  }
}

module.exports = GlobalConfigGet;
