import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { log, logError } from '../utils/log';
import { parseChannelIds } from '../utils/parseChannelIds';
// Note: Bun automatically reads .env files

class BirthdayScheduler {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  // Start the scheduler to run every hour
  start(): void {
    cron.schedule('0 * * * *', async () => { // * * * * * every minute for testing, change to '0 * * * *' for every hour
      const now = new Date();
      const utcMonth = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const utcDay = now.getUTCDate().toString().padStart(2, '0');
      const utcHour = now.getUTCHours().toString().padStart(2, '0');
      const todayHour = `${utcMonth}-${utcDay}T${utcHour}`; // MM-DDTHH format
      log(`Checking for birthdays on ${todayHour} (UTC)`);

      try {
        const birthdays = await this.client.db.user.getUsersWithBirthday(todayHour);
        log(`Users with birthdays this hour: ${birthdays}`);

        if (birthdays.length > 0) {
          // Read from DB first, fall back to env var
          const dbChannels = await this.client.db.globalConfig.getGlobalConfig('birthday_channels');
          const channelIds = parseChannelIds(dbChannels || process.env.BIRTHDAY_CHANNELS);
          for (const channelId of channelIds) {
            const channel = this.client.channels.cache.get(channelId.trim()); // Trim spaces and get the channel
            if (!channel) {
              logError(`Channel ID ${channelId} not found or invalid.`);
              continue;
            }

            for (const user of birthdays) {
              const discordUser = await this.client.users.fetch(user.id).catch(() => null);
              const username = discordUser ? discordUser.username : `Unknown User (${user.id})`;
              const avatarUrl = discordUser?.displayAvatarURL({ extension: 'png', size: 4096 }) ?? null;

              const birthdayEmbed = new EmbedBuilder()
                .setTitle('🎉 Birthday Alert! 🎉')
                .setDescription(`Today is ${username}'s birthday! Let's all wish them a great day! 🥳`)
                .setColor(0x00FF00);
              if (avatarUrl) birthdayEmbed.setImage(avatarUrl);

              log(`Sending birthday message for ${user.id} to channel ${channelId}`);
              await channel.send({
                content: `<@${user.id}>`,
                embeds: [birthdayEmbed],
              });
            }
          }
        } else {
          log('No birthdays this hour.');
        }
        log('Birthday check complete.');
      } catch (error) {
        logError('Error during birthday check:', error);
      }
    });

    // Daily reminder check at midnight UTC
    cron.schedule('0 0 * * *', async () => {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      log(`Running daily birthday reminder check for year ${currentYear}`);

      try {
        const pending = await this.client.db.birthdayReminder.getPendingReminders(currentYear);
        log(`Found ${pending.length} pending reminder(s) to evaluate`);

        for (const entry of pending) {
          const birthday = new Date(entry.birthdays);

          // Calculate next occurrence of this birthday, preserving stored UTC time
          const thisYear = new Date(birthday);
          thisYear.setUTCFullYear(currentYear);
          const nextBirthday = thisYear < now
            ? new Date(new Date(birthday).setUTCFullYear(currentYear + 1))
            : thisYear;

          const daysUntil = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntil !== entry.daysBefore) continue;

          // Fetch users
          const trackedUser = await this.client.users.fetch(entry.trackedUserId).catch(() => null);
          const notifier = await this.client.users.fetch(entry.notifierId).catch(() => null);

          if (!notifier) {
            logError(`Could not fetch notifier ${entry.notifierId} for reminder`);
            continue;
          }

          const trackedName = trackedUser ? trackedUser.username : `Unknown User (${entry.trackedUserId})`;

          const reminderEmbed = new EmbedBuilder()
            .setTitle('🎂 Birthday Reminder!')
            .setDescription(
              `**${trackedName}**'s birthday is in **${entry.daysBefore} day${entry.daysBefore === 1 ? '' : 's'}**!\n`
              + 'Be sure to ready a gift or a wish! 🎁',
            )
            .setColor(0xFFAA00);

          try {
            await notifier.send({ embeds: [reminderEmbed] });
            log(`Sent birthday reminder to ${entry.notifierId} about ${entry.trackedUserId}`);
            await this.client.db.birthdayReminder.markReminderSent(entry.notifierId, entry.trackedUserId, currentYear);
          } catch (dmError) {
            logError(`Could not DM notifier ${entry.notifierId} (DMs may be disabled):`, dmError);
          }
        }

        log('Daily birthday reminder check complete.');
      } catch (error) {
        logError('Error during daily reminder check:', error);
      }
    }, { timezone: 'UTC' });
  }
}

export default BirthdayScheduler;
