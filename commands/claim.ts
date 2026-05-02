import * as Discord from 'discord.js';

import { format } from '../utils/math';
import { Command } from './classes/Command';
import { logError } from '../utils/log';
import { processClaim } from '../utils/claim';

class Claim extends Command {
  constructor(client: any) {
    super(client, 'claim', 'Claim your daily dinonuggies', [], { blame: 'both' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const result = await processClaim(this.client, interaction.user.id);

      if (result.status === 'cooldown') {
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setTitle(result.title)
              .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
              .setDescription(`You can claim your next nuggie in ${result.hoursRemaining} hours.`)
              .setColor('#FF0000')
              .setImage(result.gifUrl)
              .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
              .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' }),
          ],
        });
      } else if (result.status === 'broken_streak') {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setThumbnail('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
            .setTitle(`${format(result.amount)} dinonuggies claimed!`)
            .setDescription(`You now have ${format(result.previousDinonuggies + result.amount)} dinonuggies. You broke your streak of ${result.previousStreak} days.`)
            .setColor('#83F28F')
            .setImage('https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa')
            .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
            .setFooter({ text: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' }),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setThumbnail(result.thumbnail)
            .setColor(result.colour as Discord.ColorResolvable)
            .setAuthor({ name: 'dinonuggie', iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' })
            .setTitle(result.title)
            .setDescription(`You now have ${format(result.previousDinonuggies + result.amount)} dinonuggies. You are on a streak of ${result.previousStreak + 1} days.`)
            .setImage(result.imageUrl)
            .setFooter({ text: `dinonuggie | ${result.footer}`, iconURL: 'https://drive.google.com/thumbnail?id=1oVDRweQoYLU6YfB01LWZpTFQiBS1fRRa' }),
          ],
        });
      }

      if (await this.client.db.globalConfig.getGlobalConfig('banned') === 'removed') {
        const embed = new Discord.EmbedBuilder()
          .setColor('Green')
          .setTitle('Welcome back!')
          .setDescription(`Thanks for your patience and support. As a result of Iruma's efforts, commands are back in ${interaction.guild.name}!

Please continue to claim, gamble, and catch!`);
        await interaction.channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logError('Error claiming dinonuggies:', error);
      await interaction.editReply({ content: 'Failed to claim dinonuggies.', ephemeral: true });
    }
  }
}

export default Claim;
