/* eslint-disable no-param-reassign */
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
      },
      {
        name: 'intoptionname',
        description: 'the name of the integer option',
        type: 3,
        required: false,
      },
      {
        name: 'intoptionvalue',
        description: 'the value of the integer option',
        type: 4,
        required: false,
      },
      {
        name: 'stringoptionname',
        description: 'the name of the string option',
        type: 3,
        required: false,
      },
      {
        name: 'stringoptionvalue',
        description: 'the value of the string option',
        type: 3,
        required: false,
      }],
      { blame: 'ei' },
    );
  }

  async run(interaction) {
    console.log(JSON.stringify(interaction.options, null, 2));
    const as = interaction.options.getUser('as');
    const command = interaction.options.getString('command');
    const subcommand = interaction.options.getString('subcommand');

    const commandName = subcommand ? `${command}.${subcommand}` : command;

    // Prevent recursion by checking if the command is 'execute'
    if (command.toLowerCase() === 'execute') {
      interaction.editReply({ content: "Cannot execute the 'execute' command as it would cause an infinite loop!", ephemeral: true });
      return;
    }

    interaction.user = as;
    interaction.member = await interaction.guild.members.fetch(as.id);
    interaction.commandName = commandName;

    const options = {
      // eslint-disable-next-line no-unused-vars
      getInteger: (_arg) => null,
      // eslint-disable-next-line no-unused-vars
      getString: (_arg) => null,
    };

    if (interaction.options.getString('intoptionname')) {
      const name = interaction.options.getString('intoptionname');
      const value = interaction.options.getInteger('intoptionvalue');
      options.getInteger = (arg) => {
        if (arg === name) {
          return value;
        }
        return null;
      };
    }
    if (interaction.options.getString('stringoptionname')) {
      const name = interaction.options.getString('stringoptionname');
      const value = interaction.options.getString('stringoptionvalue', true);
      options.getString = (arg) => {
        if (arg === name) {
          return value;
        }
        return null;
      };
    }

    interaction.options = options;

    // Process the interaction as if it came from the target user
    await this.client.processInteraction(interaction);
  }
}

module.exports = Execute;
