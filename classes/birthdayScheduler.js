const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();  // This loads the environment variables from .env

class BirthdayScheduler {
    constructor(client) {
        this.client = client;
    }

    // Start the scheduler to run daily at midnight (00:00)
    start() {
        cron.schedule('0 0 * * *', async () => {
            const now = new Date();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const today = `${month}-${day}`;  // MM-DD format
            console.log(`Checking for birthdays on ${today}`);
        
            try {
                const birthdays = await this.client.db.getUsersWithBirthday(today);
                console.log('Users with birthdays today:', birthdays);
        
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
                    console.log('No birthdays today.');
                }
                console.log('Birthday check complete.');
            } catch (error) {
                console.error('Error during birthday check:', error);
            }
        });
    }
}

module.exports = BirthdayScheduler;
