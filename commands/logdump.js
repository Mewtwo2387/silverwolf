const fs = require('fs').promises;
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

    if (lines < 1) {
      await interaction.editReply({ content: 'Invalid number of lines' });
      return;
    }
    const type = interaction.options.getString('type');
    const path = type === 'error' ? logErrorFilePath : logFilePath;
    try {
      const log = await fs.readFile(path, 'utf8');
      const logLines = log.split('\n').slice(-lines);
      const content = logLines.join('\n');
      if (content.length > 1990) {
        const buffer = Buffer.from(content);
        await interaction.editReply({ files: [{ attachment: buffer, name: `${type}.txt` }] });
      } else {
        await interaction.editReply({ content: `\`\`\`${content}\`\`\`` });
      }
    } catch (error) {
      logError('Error dumping log:', error);
      await interaction.editReply({ content: 'Error dumping log' });
    }
  }
}

module.exports = LogDump;
