const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');

class Eval extends DevCommand {
  constructor(client) {
    super(client, 'eval', 'evaluate js code. most dangerous command???', [{
      name: 'code',
      description: 'js code',
      type: 3,
      required: true,
    }], { blame: 'ei' });
  }

  async run(interaction) {
    const input = interaction.options.getString('code');
    try {
      // eslint-disable-next-line no-eval
      interaction.editReply(`${eval(input)}`);
    } catch (error) {
      logError('Error evaluating code:', error);
      interaction.editReply(`Error: ${error.message}`);
    }
  }
}

module.exports = Eval;
