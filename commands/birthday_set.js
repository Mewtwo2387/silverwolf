const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { log, logError } = require('../utils/log');

function parseTimezone(raw) {
  const match = raw.trim().match(/^([+-])?(\d{1,2})(?:\.(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1] === '-' ? '-' : '+';
  const hours = parseInt(match[2], 10);
  const minutes = match[3] !== undefined ? parseInt(match[3], 10) : 0;

  if (hours > 14 || (hours === 14 && minutes > 0)) return null;
  if (minutes > 59) return null;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

class BirthdaySet extends Command {
  constructor(client) {
    super(client, 'set', 'Sets your birthday. Enter 0 for all values to delete your birthday entry.', [
      {
        name: 'day',
        description: 'Day of the month (1-31), or 0 to delete your birthday',
        type: 4,
        required: true,
      },
      {
        name: 'month',
        description: 'Month (1-12), or 0 to delete your birthday',
        type: 4,
        required: true,
      },
      {
        name: 'year',
        description: 'Year (e.g. 1990), or 0 to delete your birthday',
        type: 4,
        required: true,
      },
      {
        name: 'timezone',
        description: 'Timezone offset (e.g. +8, -5, +5.30, 10.00). Defaults to UTC.',
        type: 3,
        required: false,
      },
    ], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async run(interaction) {
    try {
      const userId = interaction.user.id;
      log(`User ${userId} triggered /birthday set command.`);

      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year');
      const rawTimezone = interaction.options.getString('timezone') || '+0';

      // Handle deletion: all three zeroes
      if (day === 0 && month === 0 && year === 0) {
        await this.client.db.user.setUserAttr(userId, 'birthdays', null);
        const embed = new EmbedBuilder()
          .setTitle('Birthday Deleted')
          .setDescription('Your birthday entry has been removed.')
          .setColor(0xFF4444);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Validate individual values (non-delete path)
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        await interaction.editReply(`Year must be between 1900 and ${currentYear}.`);
        return;
      }
      if (month < 1 || month > 12) {
        await interaction.editReply('Month must be between 1 and 12.');
        return;
      }
      const maxDay = daysInMonth(month, year);
      if (day < 1 || day > maxDay) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        if (day > 28 && month === 2) {
          await interaction.editReply(`${monthNames[month - 1]} ${year} only has ${maxDay} days.`);
        } else {
          await interaction.editReply(`${monthNames[month - 1]} does not have a day ${day}. It has ${maxDay} days.`);
        }
        return;
      }

      // Parse timezone
      const timezone = parseTimezone(rawTimezone);
      if (!timezone) {
        await interaction.editReply(
          'Invalid timezone format. Use formats like `+8`, `-5`, `+5.30`, or `10.00` (hours.minutes, max ±14:00).',
        );
        return;
      }

      log(`Received inputs: day=${day}, month=${month}, year=${year}, timezone=${timezone}`);

      const birthday = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00${timezone}`);
      if (Number.isNaN(birthday.getTime())) {
        await interaction.editReply('Could not parse that date — double-check your inputs.');
        return;
      }

      log(`Constructed birthday: ${birthday.toISOString()}`);
      await this.client.db.user.setUserAttr(userId, 'birthdays', birthday.toISOString());
      log(`Successfully updated birthday for user ${userId}.`);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const formattedDate = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;

      const embed = new EmbedBuilder()
        .setTitle('Birthday Set!')
        .setDescription(`Your birthday has been set to ${formattedDate} (timezone: ${timezone}).`)
        .setColor(0x00FF00);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError(`Error setting birthday for user ${interaction.user.id}:`, error);
      await interaction.editReply(`Error setting birthday: ${error.message}`);
    }
  }
}

module.exports = BirthdaySet;
