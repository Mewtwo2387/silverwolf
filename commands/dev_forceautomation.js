const { DevCommand } = require('./classes/devcommand');

class ForceAutomation extends DevCommand {
  constructor(client) {
    super(client, 'forceautomation', 'force a baby task', [
      {
        name: 'frequency',
        description: 'the frequency of the automation',
        type: 3,
        required: true,
        choices: [
          { name: 'daily', value: 'daily' },
          { name: 'ten_minutes', value: 'ten_minutes' },
        ],
      },
    ], { ephemeral: true, isSubcommandOf: 'dev', blame: 'ei' });
  }

  async run(interaction) {
    const frequency = interaction.options.getString('frequency');
    switch (frequency) {
      case 'daily':
        await this.client.babyScheduler.dailyAutomations();
        interaction.editReply('Daily automations forced');
        break;
      case 'ten_minutes':
        await this.client.babyScheduler.tenMinuteAutomations();
        interaction.editReply('Ten minute automations forced');
        break;
      default:
        interaction.editReply('Invalid frequency');
        break;
    }
  }
}

module.exports = ForceAutomation;
