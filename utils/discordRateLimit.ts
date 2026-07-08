import type { ChatInputCommandInteraction } from 'discord.js';
import type Database from '../database/Database';
import { DAILY_LIMIT, WEEKLY_LIMIT } from './ai';

export async function getRateLimitErrorMessage(userId: string, db: Database): Promise<string> {
  const dailyUsage = await db.aiUsage.getDailyUsage(userId);
  const weeklyUsage = await db.aiUsage.getWeeklyUsage(userId);
  const reachedDaily = dailyUsage >= DAILY_LIMIT;

  const limitLabel = reachedDaily ? 'Daily' : 'Weekly';
  const usageVal = reachedDaily ? dailyUsage : weeklyUsage;
  const limitVal = reachedDaily ? DAILY_LIMIT : WEEKLY_LIMIT;

  return `⚠️ **${limitLabel} AI Rate Limit Reached**\nYou have consumed **${usageVal.toLocaleString()}** / **${limitVal.toLocaleString()}** tokens in the last ${reachedDaily ? '24 hours' : '7 days'}. Please wait for your token pool to cool down.`;
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
