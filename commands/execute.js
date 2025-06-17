const { DevCommand } = require('./classes/devcommand');

class Execute extends DevCommand {
  constructor(client) {
    super(
      client,
      'execute',
      'execute as someone',
      [{
        name: 'as',
        description: 'the user to execute as',
        type: 6,
        required: true,
      },
      {
        name: 'command',
        description: 'the command to execute',
        type: 3,
        required: true,
      },
      {
        name: 'subcommand',
        description: 'the subcommand to execute',
        type: 3,
        required: false,
      }],
    );
  }

  async run(interaction) {
    const as = interaction.options.getUser('as');
    const command = interaction.options.getString('command');
    const subcommand = interaction.options.getString('subcommand');

    const commandName = subcommand ? `${command}.${subcommand}` : command;

    // Prevent recursion by checking if the command is 'execute'
    if (command.toLowerCase() === 'execute') {
      interaction.editReply({ content: "Cannot execute the 'execute' command as it would cause an infinite loop!", ephemeral: true });
      return;
    }

    const newInteraction = interaction.clone();

    newInteraction.user = as;
    newInteraction.member = await interaction.guild.members.fetch(as.id);
    newInteraction.commandName = commandName;

    // Process the interaction as if it came from the target user
    await this.client.processInteraction(newInteraction);
  }
}

module.exports = Execute;
