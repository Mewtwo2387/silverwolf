import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class BirthdayGet extends Command {
  constructor(client: any) {
    super(client, 'get', "Retrieve a user's birthday", [
      {
        name: 'user',
        description: 'The user whose birthday you want to retrieve',
        type: 6,
        required: true,
      },
    ], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const user = interaction.options.getUser('user');
      const userId = user.id;

      const birthdayData = await this.client.db.user.getUserAttr(userId, 'birthdays');
      if (!birthdayData) {
        await interaction.editReply(`${user.username} has not set their birthday.`);
        return;
      }

      const birthday = new Date(birthdayData);
      const now = new Date();

      const lastBirthday = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
      if (lastBirthday > now) {
        lastBirthday.setFullYear(lastBirthday.getFullYear() - 1);
      }
      const yearsAgo = now.getFullYear() - birthday.getFullYear() - (now < lastBirthday ? 1 : 0);

      const nextBirthday = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
      if (nextBirthday < now) {
        nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      }
      const daysUntilNext = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const birthdayTimestamp = Math.floor(birthday.getTime() / 1000);
      const nextBirthdayTimestamp = Math.floor(nextBirthday.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Birthday`)
        .setColor(0x00AAFF)
        .addFields([
          { name: 'Birthday', value: `<t:${birthdayTimestamp}:D>`, inline: true },
          { name: 'Years Ago', value: `${yearsAgo} years ago`, inline: true },
          { name: 'Next Birthday', value: `In ${daysUntilNext} days (<t:${nextBirthdayTimestamp}:R>)`, inline: true },
        ]);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error retrieving birthday:', error);
      await interaction.editReply('There was an error retrieving the birthday. Please try again later.');
    }
  }
}

export default BirthdayGet;
