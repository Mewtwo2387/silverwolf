const { DevCommand } = require('./classes/devcommand.js');

class GlobalConfigSet extends DevCommand {
    constructor(client) {
        super(client, "setglobalconfig", "Set a global config value", [
            {
                name: 'key',
                description: 'config key',
                type: 3, // String type
                required: true
            },
            {
                name: 'value',
                description: 'config value',
                type: 3, // String type
                required: true
            }
        ]);
    }

    async run(interaction) {
        const key = interaction.options.getString('key');
        const value = interaction.options.getString('value');
        await this.client.db.setGlobalConfig(key, value);
        await interaction.editReply(`${key} set to ${value}`);
    }
}

module.exports = GlobalConfigSet;

