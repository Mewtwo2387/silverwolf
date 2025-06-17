const { Command } = require('./classes/command');

class Blame extends Command {
  constructor(client) {
    super(client, 'blame', 'spam ping the author of a command', [
      {
        name: 'command',
        description: 'the name of the command to blame',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    let commandName = interaction.options.getString('command');
    commandName = commandName.toLowerCase().replace(/ /g, '.');

    const command = this.client.commands.get(commandName);

    if (!command) {
      await interaction.editReply({ content: 'command not found' });
      return;
    }

    switch (command.blame) {
      case 'ei':
        await this.spamPing(interaction, '595491647132008469', commandName);
        break;
      case 'xei':
        await this.spamPing(interaction, '964521557823197184', commandName);
        break;
      default:
        await interaction.editReply({ content: 'command dev not found' });
        break;
    }
  }

  async spamPing(interaction, uid, commandName) {
    await interaction.editReply({ content: `blame <@${uid}> for ${commandName}` });
    for (let i = 1; i <= 5; i += 1) {
      setTimeout(() => {
        interaction.followUp({ content: `<@${uid}>` });
      }, i * 1000);
    }
  }
}

module.exports = Blame;
