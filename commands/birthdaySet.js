const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');

class SetBirthdayCommand extends Command {
    constructor(client, database) {
        super(client, "set_birthday", "Sets your birthday", [
            {
                name: 'day',
                description: 'Day of the month (1-31)',
                type: 4,
                required: true
            },
            {
                name: 'month',
                description: 'Month (1-12)',
                type: 4,
                required: true
            },
            {
                name: 'year',
                description: 'Year (e.g., 1990)',
                type: 4,
                required: true
            },
            {
                name: 'timezone',
                description: 'Timezone offset in ±HH:MM format (e.g. +08:00)',
                type: 3,
                required: false
            }
        ]);

        this.database = database;  // Injecting the database instance
    }

    async run(interaction) {
        try {
            const userId = interaction.user.id;
            console.log(`User ${userId} triggered /set_birthday command.`);

            const day = interaction.options.getInteger('day');
            const month = interaction.options.getInteger('month');
            const year = interaction.options.getInteger('year');
            const timezone = interaction.options.getString('timezone');

            console.log(`Received inputs: day=${day}, month=${month}, year=${year}, timezone=${timezone}`);

            // Validate the inputs
            if (!day || !month || !year || !timezone) {
                throw new Error("Invalid inputs: Missing day, month, year, or timezone.");
            }

            const birthday = new Date(year, month - 1, day); // Months are 0-indexed
            console.log(`Constructed birthday: ${birthday.toISOString()}`);

            if (isNaN(birthday.getTime())) {
                throw new Error("Invalid date constructed. Please check the inputs.");
            }

            // Logging before setting the user birthday in the database
            console.log(`Attempting to set birthday for user ${userId} to ${birthday.toISOString()}.`);
            
            // Ensure the database object exists and the method is defined
            if (!this.database || typeof this.database.setUserAttr !== 'function') {
                throw new Error("Database is not properly initialized or setUserAttr method is missing.");
            }

            // Set birthday in the database
            await this.database.setUserAttr(userId, 'birthdays', birthday.toISOString());
            console.log(`Successfully updated birthday for user ${userId}.`);

            // Send confirmation message
            const embed = new EmbedBuilder()
                .setTitle('Birthday Set!')
                .setDescription(`Your birthday has been set to ${birthday.toDateString()} in timezone ${timezone}.`)
                .setColor(0x00FF00);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            // Log the detailed error
            console.error(`Error setting birthday for user ${interaction.user.id}:`, error);

            await interaction.editReply(`Error setting birthday: ${error.message}`);
        }
    }
}

module.exports = SetBirthdayCommand;
