const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { log, logError } = require('../utils/log');
// Note: Bun automatically reads .env files

class BirthdayScheduler {
  constructor(client) {
    this.client = client;
  }

  // Start the scheduler to run every hour
  start() {
    cron.schedule('0 * * * *', async () => { // * * * * * every minute for testing, change to '0 * * * *' for every hour
      const now = new Date();
      const utcMonth = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const utcDay = now.getUTCDate().toString().padStart(2, '0');
      const utcHour = now.getUTCHours().toString().padStart(2, '0');
      const todayHour = `${utcMonth}-${utcDay}T${utcHour}`; // MM-DDTHH format
      log(`Checking for birthdays on ${todayHour} (UTC)`);

      try {
        const birthdays = await this.client.db.user.getUsersWithBirthday(todayHour);
        log('Users with birthdays this hour:', birthdays);

        if (birthdays.length > 0) {
          const channelIds = process.env.BIRTHDAY_CHANNELS.split(','); // Get all channel IDs from .env
          channelIds.forEach(async (channelId) => {
            const channel = this.client.channels.cache.get(channelId.trim()); // Trim spaces and get the channel
            if (!channel) {
              logError(`Channel ID ${channelId} not found or invalid.`);
              return;
            }

            birthdays.forEach(async (user) => {
              const discordUser = await this.client.users.fetch(user.id).catch(() => null);
              const username = discordUser ? discordUser.username : `Unknown User (${user.id})`;

              const birthdayEmbed = new EmbedBuilder()
                .setTitle('🎉 Birthday Alert! 🎉')
                .setDescription(`Today is ${username}'s birthday! Let's all wish them a great day! 🥳`)
                .setImage(discordUser.displayAvatarURL({ dynamic: true, format: 'png', size: 4096 }))
                .setColor(0x00FF00);

              log(`Sending birthday message for ${user.id} to channel ${channelId}`);
              await channel.send({
                content: `<@${user.id}>`,
                embeds: [birthdayEmbed],
              });
            });
          });
        } else {
          log('No birthdays this hour.');
        }
        log('Birthday check complete.');
      } catch (error) {
        logError('Error during birthday check:', error);
      }
    });
  }
}

module.exports = BirthdayScheduler;
