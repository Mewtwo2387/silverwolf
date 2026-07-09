import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../utils/ai';
import { getResetLine } from '../utils/discordRateLimit';

function makeProgressBar(value: number, total: number, size = 15): string {
  const percentage = Math.min(Math.max(value / total, 0), 1);
  const filledLength = Math.round(percentage * size);
  const emptyLength = size - filledLength;
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  const pctText = Math.round(percentage * 100);
  return `\`[${bar}]\` **${pctText}%**`;
}

class AiUsageSubcommand extends Command {
  constructor(client: any) {
    super(client, 'usage', 'View your AI token usage and limits', [], {
      isSubcommandOf: 'ai',
      blame: 'xei',
    });
  }

  async run(interaction: Discord.ChatInputCommandInteraction) {
    try {
      const userId = interaction.user.id;
      const [dailyUsage, weeklyUsage, status] = await Promise.all([
        this.client.db.aiUsage.getDailyUsage(userId),
        this.client.db.aiUsage.getWeeklyUsage(userId),
        this.client.db.aiUsage.checkRateLimit(userId),
      ]);

      const dailyBar = makeProgressBar(dailyUsage, DAILY_LIMIT);
      const weeklyBar = makeProgressBar(weeklyUsage, WEEKLY_LIMIT);

      const statusText = status.limited
        ? `🛑 **Rate Limited** (${status.reason === 'daily' ? 'Daily' : 'Weekly'} limit exceeded)`
        : '✅ **Active** (within limits)';

      const resetLine = await getResetLine(this.client.db, userId, status);

      const embed = new Discord.EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🤖 Your AI Token Usage')
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setDescription(`
**Daily Usage (24h):**
${dailyUsage.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()} tokens
${dailyBar}

**Weekly Usage (7d):**
${weeklyUsage.toLocaleString()} / ${WEEKLY_LIMIT.toLocaleString()} tokens
${weeklyBar}

**Status:** ${statusText}${resetLine}
        `)
        .setFooter({ text: 'Note: AI roleplay cost is shared among active users in the chat.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({
        content: '❌ Failed to fetch your AI usage stats. Please try again later.',
      });
    }
  }
}

export default AiUsageSubcommand;
