import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { log, logError } from '../utils/log';

class Awdangit extends Command {
  constructor(client: any) {
    super(client, 'awdangit', '99% chance to earn $1M, 1% chance to become a girl', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    if (Math.random() < 0.01) {
      const roleId = await this.client.db.serverRoles.getServerRole(interaction.guild.id, 'girl');
      const role = interaction.member.guild.roles.cache.find((r: any) => r.id === roleId);

      log(`${interaction.user.username} became a girl`);

      if (roleId === null) {
        logError(`Girl role is not set up for ${interaction.guild.name}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Error')
              .setDescription('Girl role is not set up for this server!')
              .setColor('#FF0000'),
          ],
        });
        return;
      }

      await interaction.member.roles.add(role);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Congrats!')
            .setDescription('You became a girl!')
            .setColor('#00FF00'),
        ],
      });
    } else {
      log(`${interaction.user.username} earned $1M`);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Aw, dang it!')
            .setDescription('You earned $1M!')
            .setColor('#FF0000'),
        ],
      });
    }
  }
}

export default Awdangit;
