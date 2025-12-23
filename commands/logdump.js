const fs = require('fs');
const { DevCommand } = require('./classes/devcommand');
const { logError } = require('../utils/log');
const { logErrorFilePath, logFilePath } = require('../utils/log');

class LogDump extends DevCommand {
  constructor(client) {
    super(client, 'logdump', 'dump the log files', [
      {
        name: 'lines',
        description: 'last n lines of the error logs',
        type: 4,
        required: true,
      },
      {
        name: 'type',
        description: 'the type of log to dump',
        type: 3,
        required: true,
        choices: [
          { name: 'error', value: 'error' },
          { name: 'log', value: 'log' },
        ],
      },
    ], { blame: 'ei' });
  }

  async run(interaction) {
    const lines = interaction.options.getInteger('lines');
    const type = interaction.options.getString('type');
    const path = type === 'error' ? logErrorFilePath : logFilePath;
    try {
      const log = fs.readFileSync(path, 'utf8');
      const logLines = log.split('\n').slice(-lines);
      await interaction.editReply({ content: `\`\`\`${logLines.join('\n')}\`\`\`` });
    } catch (error) {
      logError('Error dumping log:', error);
      await interaction.editReply({ content: 'Error dumping log' });
    }
  }
}

module.exports = LogDump;
