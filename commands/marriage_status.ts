import * as Discord from 'discord.js';
import { Command } from './classes/Command';

class MarriageStatus extends Command {
  constructor(client: any) {
    super(client, 'status', "Check your or another user's marriage status", [
      {
        name: 'user',
        description: 'The user whose marriage status you want to check (optional)',
        type: 6,
        required: false,
      },
    ], { isSubcommandOf: 'marriage', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const marriageStatus = await this.client.db.marriage.checkMarriageStatus(targetUser.id);

    if (marriageStatus.isMarried) {
      const marriagePartnerId = marriageStatus.partnerId;
      const marriagePartner = await this.client.users.fetch(marriagePartnerId);

      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Marriage Status')
          .setDescription(`${targetUser.username} is married to ${marriagePartner.username}. 💍`),
        ],
      });
    } else {
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

export default MarriageStatus;
