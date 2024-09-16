const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();  // Load the environment variables

class BirthdayScheduler {
    constructor(client) {
        this.client = client;
    }

    // Start the scheduler to run every hour
    start() {
        cron.schedule('0 * * * *', async () => {  // This runs at the start of every hour
            const now = new Date();
            const utcMonth = (now.getUTCMonth() + 1).toString().padStart(2, '0');
            const utcDay = now.getUTCDate().toString().padStart(2, '0');
            const utcHour = now.getUTCHours().toString().padStart(2, '0');
            const todayHour = `${utcMonth}-${utcDay}T${utcHour}`;  // MM-DDTHH format
            console.log(`Checking for birthdays on ${todayHour} (UTC)`);

            try {
                const birthdays = await this.client.db.getUsersWithBirthday(todayHour);
                console.log('Users with birthdays this hour:', birthdays);

                if (birthdays.length > 0) {
                    const channel = this.client.channels.cache.get(process.env.BIRTHDAY_CHANNEL);  // Use the .env variable
                    for (const user of birthdays) {
                        const birthdayEmbed = new EmbedBuilder()
                            .setTitle('🎉 Birthday Alert! 🎉')
                            .setDescription(`Today is <@${user.id}>'s birthday! Let's all wish them a great day! 🥳`)
                            .setColor(0x00FF00);

                        console.log(`Sending birthday message for ${user.id}`);
                        await channel.send({ embeds: [birthdayEmbed] });
                    }
                } else {
                    console.log('No birthdays this hour.');
                }
                console.log('Birthday check complete.');
            } catch (error) {
                console.error('Error during birthday check:', error);
            }
        });
    }
}

module.exports = BirthdayScheduler;
