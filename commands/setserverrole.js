const { EmbedBuilder } = require('discord.js');
const { DevCommand } = require('./classes/devcommand');

class SetServerRole extends DevCommand {
  constructor(client) {
    super(client, 'setserverrole', 'set server role', [
      {
        name: 'roleName',
        description: 'the name of the role to set',
        type: 3,
        required: true,
      },
      {
        name: 'role',
        description: 'the role to set',
        type: 8,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const roleName = interaction.options.getString('roleName');
    const role = interaction.options.getRole('role');

    this.client.db.setServerRole(interaction.guild.id, roleName, role.id);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Server Role Set')
          .setDescription(`The role ${roleName} has been set to ${role.name}.`)
          .setColor('#00FF00'),
      ],
    });
  }
}

module.exports = SetServerRole;
