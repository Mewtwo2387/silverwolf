const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');
const { logError } = require('../utils/log');

class GetBirthdayCommand extends Command {
    constructor(client) {
        super(client, "get_birthday", "Retrieve a user's birthday", [
            {
                name: 'user',
                description: 'The user whose birthday you want to retrieve',
                type: 6, // User type
                required: true
            }
        ]);
    }

    async run(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const userId = user.id;

            // Retrieve birthday from the database
            const birthdayData = await this.client.db.getUserAttr(userId, 'birthdays');
            if (!birthdayData) {
                return interaction.editReply(`${user.username} has not set their birthday.`);
            }

            const birthday = new Date(birthdayData);
            const now = new Date();

            // Calculate how many years ago the last birthday was
            let lastBirthday = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
            if (lastBirthday > now) {
                lastBirthday.setFullYear(lastBirthday.getFullYear() - 1);
            }
            const yearsAgo = now.getFullYear() - birthday.getFullYear() - (now < lastBirthday ? 1 : 0);

            // Calculate the next birthday
            let nextBirthday = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
            if (nextBirthday < now) {
                nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
            }
            const daysUntilNext = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));

            // Create Discord timestamps
            const birthdayTimestamp = Math.floor(birthday.getTime() / 1000);
            const nextBirthdayTimestamp = Math.floor(nextBirthday.getTime() / 1000);

            // Build and send the embed
            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Birthday`)
                .setColor(0x00AAFF)
                .addFields([
                    { name: 'Birthday', value: `<t:${birthdayTimestamp}:D>`, inline: true },
                    { name: 'Years Ago', value: `${yearsAgo} years ago`, inline: true },
                    { name: 'Next Birthday', value: `In ${daysUntilNext} days (<t:${nextBirthdayTimestamp}:R>)`, inline: true }
                ]);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logError('Error retrieving birthday:', error);
            await interaction.editReply('There was an error retrieving the birthday. Please try again later.');
        }
    }
}

module.exports = GetBirthdayCommand;
