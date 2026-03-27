const { Command } = require('./classes/command');

class Hello extends Command {
  constructor(client) {
    super(client, 'hello', 'hello', [], { blame: 'both' }); // because honestly if this breaks everyone deserves to be spammed
  }

  async run(interaction) {
    await interaction.editReply(`Hello ${interaction.user.username}!`);
  }
}

module.exports = Hello;
