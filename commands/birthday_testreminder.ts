import { EmbedBuilder } from 'discord.js';
import { DevCommand } from './classes/DevCommand';
import { log, logError } from '../utils/log';

class BirthdayTestReminder extends DevCommand {
  constructor(client: any) {
    super(client, 'testreminder', 'Immediately fires all your pending birthday reminders as DMs', [], { isSubcommandOf: 'birthday', blame: 'xei' });
  }

  async execute(interaction: any): Promise<void> {
    await super.execute(interaction);
    if (interaction.replied) return;

    await interaction.deferReply({ ephemeral: true });

    const notifierId = interaction.user.id;
    const currentYear = new Date().getUTCFullYear();

    const pending = await this.client.db.birthdayReminder.getPendingReminders(currentYear);
    const mine = pending.filter((r: any) => r.notifierId === notifierId);

    if (mine.length === 0) {
      await interaction.editReply('No pending reminders found for your account. Set one with `/birthday notify` first.');
      return;
    }

    const results: string[] = [];

    for (const entry of mine) {
      const trackedUser = await this.client.users.fetch(entry.trackedUserId).catch(() => null);
      const trackedName = trackedUser ? trackedUser.username : `Unknown User (${entry.trackedUserId})`;

      const reminderEmbed = new EmbedBuilder()
        .setTitle('🎂 Birthday Reminder! (TEST)')
        .setDescription(
          `**${trackedName}**'s birthday is in **${entry.daysBefore} day${entry.daysBefore === 1 ? '' : 's'}**!\n`
          + 'Be sure to ready a gift or a wish! 🎁',
        )
        .setColor(0xFFAA00);

      try {
        await interaction.user.send({ embeds: [reminderEmbed] });
        log(`Test reminder sent to ${notifierId} about ${entry.trackedUserId}`);
        results.push(`✅ Sent reminder for **${trackedName}** (${entry.daysBefore}d before)`);
      } catch (dmError) {
        logError(`Could not DM ${notifierId} during test:`, dmError);
        results.push(`❌ Failed to DM reminder for **${trackedName}** — your DMs may be disabled`);
      }
    }

    await interaction.editReply(results.join('\n'));
  }
}

export default BirthdayTestReminder;
