import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from '../database/Database';
import { DAILY_LIMIT, WEEKLY_LIMIT } from './ai';

/**
 * Renders a rate-limit reset time as a Discord short-time + relative stamp,
 * e.g. "3:04 PM (in about 2 hours)" — resolved to each viewer's local clock.
 */
export function formatResetTimestamp(resetAt: Date): string {
  const unix = Math.floor(resetAt.getTime() / 1000);
  return `<t:${unix}:t> (<t:${unix}:R>)`;
}

export async function getRateLimitErrorMessage(userId: string, db: Database): Promise<string> {
  const [dailyUsage, weeklyUsage] = await Promise.all([
    db.aiUsage.getDailyUsage(userId),
    db.aiUsage.getWeeklyUsage(userId),
  ]);
  const reachedDaily = dailyUsage >= DAILY_LIMIT;

  const reason: 'daily' | 'weekly' = reachedDaily ? 'daily' : 'weekly';
  const limitLabel = reachedDaily ? 'Daily' : 'Weekly';
  const usageVal = reachedDaily ? dailyUsage : weeklyUsage;
  const limitVal = reachedDaily ? DAILY_LIMIT : WEEKLY_LIMIT;
  const windowLabel = reachedDaily ? '24 hours' : '7 days';

  const resetAt = await db.aiUsage.getResetAt(userId, reason);
  const cooldownNote = resetAt
    ? `Your pool cools down enough to use again ${formatResetTimestamp(resetAt)}.`
    : 'Please wait for your token pool to cool down.';

  return `⚠️ **${limitLabel} AI Rate Limit Reached**\nYou have consumed **${usageVal.toLocaleString()}** / **${limitVal.toLocaleString()}** tokens in the last ${windowLabel}. ${cooldownNote}`;
}

export async function handleRateLimitError(
  interaction: ChatInputCommandInteraction,
  db: Database,
): Promise<void> {
  const content = await getRateLimitErrorMessage(interaction.user.id, db);
  await interaction.editReply({
    content,
  });
}
