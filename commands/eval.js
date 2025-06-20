const { DevCommand } = require('./classes/devcommand');

class Eval extends DevCommand {
  constructor(client) {
    super(client, 'eval', 'evaluate js code. most dangerous command???', [{
      name: 'code',
      description: 'js code',
      type: 3,
      required: true,
    }]);
  }

  async run(interaction) {
    const input = interaction.options.getString('code');
    try {
      // eslint-disable-next-line no-eval
      interaction.editReply(`${eval(input)}`);
    } catch (error) {
      interaction.editReply(`Error: ${error.message}`);
    }
  }
}

module.exports = Eval;
