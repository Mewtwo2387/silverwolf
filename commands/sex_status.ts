import * as Discord from 'discord.js';
import { Command } from './classes/Command';

class SexStatus extends Command {
  constructor(client: any) {
    super(client, 'status', "Check the status of you or another user's sex session", [
      {
        name: 'user',
        description: 'The user to check the status of',
        type: 6,
        required: false,
      },
    ], { isSubcommandOf: 'sex', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const user = interaction.options.getUser('user') || interaction.user;
    const userId = user.id;
    const session = this.client.sexSessions.find((s: any) => s.hasUser(userId));
    if (session) {
      const embed = new Discord.EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${user.username}'s sex session`)
        .setDescription(`<@${session.otherUser(userId)}> is currently fucking <@${userId}>!
They've done ${session.thrusts} thrusts`);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new Discord.EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`${user.username} is currently not fucking anyone!`);
      await interaction.editReply({ embeds: [embed] });
    }
  }
}

export default SexStatus;
