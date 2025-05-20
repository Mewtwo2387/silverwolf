const { DevCommand } = require('./classes/devcommand.js');

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
      }],
    );
  }

  async run(interaction) {
    const as = interaction.options.getUser('as');
    const command = interaction.options.getString('command');

    // Prevent recursion by checking if the command is 'execute'
    if (command.toLowerCase() === 'execute') {
      return interaction.editReply({ content: "Cannot execute the 'execute' command as it would cause an infinite loop!", ephemeral: true });
    }

    // Set the user and member to the target user
    interaction.user = as;
    interaction.member = await interaction.guild.members.fetch(as.id);
    interaction.commandName = command;

    // Process the interaction as if it came from the target user
    await this.client.processInteraction(interaction);
  }
}

module.exports = Execute;
