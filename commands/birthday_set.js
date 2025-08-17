const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { log, logError } = require('../utils/log');

class BirthdaySet extends Command {
  constructor(client) {
    super(client, 'set', 'Sets your birthday', [
      {
        name: 'day',
        description: 'Day of the month (1-31)',
        type: 4,
        required: true,
      },
      {
        name: 'month',
        description: 'Month (1-12)',
        type: 4,
        required: true,
      },
      {
        name: 'year',
        description: 'Year (e.g., 1990)',
        type: 4,
        required: true,
      },
      {
        name: 'timezone',
        description: 'Timezone offset in ±HH:MM format (e.g. +08:00)',
        type: 3,
        required: false,
      },
    ], { isSubcommandOf: 'birthday' });
  }

  async run(interaction) {
    try {
      const userId = interaction.user.id;
      log(`User ${userId} triggered /set_birthday command.`);

      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year');
      const timezone = interaction.options.getString('timezone') || '+00:00'; // Default to UTC if not provided

      log(`Received inputs: day=${day}, month=${month}, year=${year}, timezone=${timezone}`);

      // Validate the inputs
      if (!day || !month || !year) {
        throw new Error('Invalid inputs: Missing day, month, or year.');
      }

      const birthday = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00${timezone}`);
      log(`Constructed birthday: ${birthday.toISOString()}`);

      if (Number.isNaN(birthday.getTime())) {
        throw new Error('Invalid date constructed. Please check the inputs.');
      }

      log(`Attempting to set birthday for user ${userId} to ${birthday.toISOString()}.`);

      const result = await this.client.db.user.setUserAttr(userId, 'birthdays', birthday.toISOString());
      log(`Successfully updated birthday for user ${userId}.`, result);
      const monthName = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const formattedDate = `${String(day).padStart(2, '0')}-${String(monthName[month-1]).padStart(2, '0')}-${year}`;

      // Send confirmation message
      const embed = new EmbedBuilder()
        .setTitle('Birthday Set!')
        .setDescription(`Your birthday has been set to ${formattedDate} (timezone: ${timezone}).`)
        .setColor(0x00FF00);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      // Log the detailed error
      logError(`Error setting birthday for user ${interaction.user.id}:`, error);

      await interaction.editReply(`Error setting birthday: ${error.message}`);
    }
  }
}

module.exports = BirthdaySet;