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

/**
 * The trailing "**Resets:** <t…>" embed line for a rate-limited user (empty
 * string when not limited or the window has already lapsed). Shared by the
 * `/ai usage` and `/profile` embeds so the wording stays in sync.
 */
export async function getResetLine(
  db: Database,
  userId: string,
  status: { limited: boolean; reason?: 'daily' | 'weekly' },
): Promise<string> {
  if (!status.limited || !status.reason) return '';
  const resetAt = await db.aiUsage.getResetAt(userId, status.reason);
  return resetAt ? `\n**Resets:** ${formatResetTimestamp(resetAt)}` : '';
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
  const windowLabel = reachedDaily ? '24-hour' : '7-day';

  const resetAt = await db.aiUsage.getResetAt(userId, reason);
  const resetNote = resetAt
    ? `Your limit resets ${formatResetTimestamp(resetAt)}.`
    : 'Please wait for your limit to reset.';

  return `⚠️ **${limitLabel} AI Rate Limit Reached**\nYou've used **${usageVal.toLocaleString()}** / **${limitVal.toLocaleString()}** tokens in the current ${windowLabel} window. ${resetNote}`;
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
