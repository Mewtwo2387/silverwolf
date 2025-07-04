const Discord = require('discord.js');
const { logError } = require('../../utils/log');
const { log } = require('../../utils/log');
const { isAllowedUser } = require('../../utils/accessControl');

class Command {
  constructor(client, name, description, options, args = {
    ephemeral: false, skipDefer: false, isSubcommandOf: null, blame: '',
  }) {
    this.client = client;
    this.name = name;
    this.description = description;
    this.options = options;
    this.ephemeral = args.ephemeral || false;
    this.skipDefer = args.skipDefer || false;
    this.isSubcommandOf = args.isSubcommandOf || null;
    this.blame = args.blame || '';
  }

  async execute(interaction) {
    if (await this.client.db.globalConfig.getGlobalConfig('banned') === 'true') {
      if (!isAllowedUser(interaction)) {
        log('ehe banned');
        const embed = new Discord.EmbedBuilder()
          .setColor('Red')
          .setTitle(`Sorry, ${this.name} isn't available right now.`)
          .setDescription(
            `A law banning ${this.name} has been enacted in ${interaction.guild.name}. `
            + 'Unfortunately, that means you can\'t use this command here.\n\n'
            + 'We are fortunate that Iruma has indication he will work with us on a solution to '
            + `reinstate ${this.name} once he is unbanned. Please stay tuned!`,
          );
        await interaction.reply({
          embeds: [embed],
        });
        return;
      }
    }

    try {
      if (this.run !== undefined) {
        // Check if deferReply should be skipped
        if (!this.skipDefer && !interaction.deferred) {
          await interaction.deferReply({
            ephemeral: this.ephemeral,
          });
        }
        await this.run(interaction); // Run the command logic
      } else {
        await interaction.editReply({
          content: 'Not implemented',
          ephemeral: true,
        });
        logError(`Command ${this.name} not implemented`);
      }
    } catch (error) {
      // Global error handling logic
      logError(`Error executing command ${this.name}:`, error);

      // Inform the user about the error, if needed
      await interaction.editReply({
        content: 'An error occurred while executing the command.\n'
        + 'Please try again later or modify the inputs.\n'
        + 'If the issue persists, run /blame command_name and spam ping whoever made the command.',
        ephemeral: true,
      });
    }
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async run(_interaction) {
    throw new Error('run method must be implemented by subclasses');
  }

  toJSON() {
    if (this.isSubcommandOf === null) {
      return {
        name: this.name,
        description: this.description,
        options: this.options,
      };
    }
    return null;
  }
}

module.exports = { Command };
