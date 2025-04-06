const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class TimestampCommand extends Command {
  constructor(client) {
    super(client, 'discord_timestamp', 'Displays the current or specified time in various formats', [
      {
        name: 'timezone',
        description: 'Timezone offset in ±HH:MM format (e.g. +08:00)',
        type: 3,
        required: false,
      },
      {
        name: 'hour',
        description: 'Hour (1-12)',
        type: 4,
        required: false,
      },
      {
        name: 'minute',
        description: 'Minute (0-59)',
        type: 4,
        required: false,
      },
      {
        name: 'second',
        description: 'Second (0-59)',
        type: 4,
        required: false,
      },
      {
        name: 'meridiem',
        description: 'AM or PM',
        type: 3,
        required: false,
        choices: [
          { name: 'AM', value: 'AM' },
          { name: 'PM', value: 'PM' },
        ],
      },
      {
        name: 'date',
        description: 'Day of the month (1-31)',
        type: 4,
        required: false,
      },
      {
        name: 'month',
        description: 'Month (1-12)',
        type: 4,
        required: false,
      },
      {
        name: 'year',
        description: 'Year (e.g., 2024)',
        type: 4,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    try {
      const now = new Date();

      let hour = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute');
      const second = interaction.options.getInteger('second');
      const meridiem = interaction.options.getString('meridiem');
      const date = interaction.options.getInteger('date');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year');
      const timezone = interaction.options.getString('timezone');

      // Convert to 24-hour format if meridiem is provided
      if (hour !== null) {
        hour = meridiem === 'PM' && hour !== 12 ? hour + 12 : hour;
        hour = meridiem === 'AM' && hour === 12 ? 0 : hour;
        now.setHours(hour);
      }
      if (minute !== null) now.setMinutes(minute);
      if (second !== null) now.setSeconds(second);
      if (date !== null) now.setDate(date);
      if (month !== null) now.setMonth(month - 1); // Months are 0-indexed
      if (year !== null) now.setFullYear(year);

      // Adjust the time based on the timezone offset relative to GMT+8
      if (timezone) {
        const [sign, hours, minutes] = timezone.match(/([+-])(\d{2}):(\d{2})/).slice(1);
        const offsetMinutes = (parseInt(hours, 10) * 60) + parseInt(minutes, 10);
        const gmt8Offset = 8 * 60; // 8 hours in minutes
        let totalOffsetMinutes;

        if (sign === '+') {
          totalOffsetMinutes = (gmt8Offset - offsetMinutes) * 60 * 1000;
        } else {
          totalOffsetMinutes = (gmt8Offset + offsetMinutes) * 60 * 1000;
        }

        now.setTime(now.getTime() + totalOffsetMinutes);
      }

      const unixTime = Math.floor(now.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle('Specified Time')
        .setColor(0x0099ff)
        .addFields([
          { name: 'Relative', value: `<t:${unixTime}:R> (\`<t:${unixTime}:R>\`)`, inline: true },
          { name: 'Short Time', value: `<t:${unixTime}:t> (\`<t:${unixTime}:t>\`)`, inline: true },
          { name: 'Long Time', value: `<t:${unixTime}:T> (\`<t:${unixTime}:T>\`)`, inline: true },
          { name: 'Short Date', value: `<t:${unixTime}:d> (\`<t:${unixTime}:d>\`)`, inline: true },
          { name: 'Long Date', value: `<t:${unixTime}:D> (\`<t:${unixTime}:D>\`)`, inline: true },
          { name: 'Short Date & Time', value: `<t:${unixTime}:f> (\`<t:${unixTime}:f>\`)`, inline: true },
          { name: 'Long Date & Time', value: `<t:${unixTime}:F> (\`<t:${unixTime}:F>\`)`, inline: true },
        ]);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply('error. you probably fucked up some inputs.');
    }
  }
}

module.exports = TimestampCommand;
