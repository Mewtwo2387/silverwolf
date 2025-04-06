const Discord = require('discord.js');
const { Command } = require('./classes/command.js');

class MarriageStatus extends Command {
  constructor(client) {
    super(client, 'status', "Check your or another user's marriage status", [
      {
        name: 'user',
        description: 'The user whose marriage status you want to check (optional)',
        type: 6, // user
        required: false,
      },
    ], { isSubcommandOf: 'marriage' });
  }

  async run(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Check marriage status using the correct reference to 'this'
    const marriageStatus = await this.client.db.checkMarriageStatus(targetUser.id);

    if (marriageStatus.isMarried) {
      // Fetch the partner's username
      const marriagePartnerId = marriageStatus.partnerId; // Adjusted to get partnerId correctly
      const marriagePartner = await this.client.users.fetch(marriagePartnerId);

      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Marriage Status')
          .setDescription(`${targetUser.username} is married to ${marriagePartner.username}. 💍`),
        ],
      });
    } else {
      // The user is single
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Marriage Status')
          .setDescription(`${targetUser.username} is currently single.`),
        ],
      });
    }
  }
}

module.exports = MarriageStatus;
