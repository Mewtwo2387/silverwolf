import * as Discord from 'discord.js';
import { DevCommand } from './classes/DevCommand';
import { recentInvocations } from '../utils/ramstats';

const toMB = (bytes: number): string => (bytes / 1024 / 1024).toFixed(2);
const signedMB = (bytes: number): string => `${bytes >= 0 ? '+' : ''}${(bytes / 1024 / 1024).toFixed(2)}`;

class RamStats extends DevCommand {
  constructor(client: any) {
    super(client, 'ramstats', 'show RAM usage breakdown for the bot process', [], {
      isSubcommandOf: 'dev',
      blame: 'ei',
    });
  }

  async run(interaction: any): Promise<void> {
    const mem = process.memoryUsage();

    const {
      rss, heapTotal, heapUsed, external, arrayBuffers,
    } = mem;
    const other = Math.max(0, rss - heapTotal - external);

    const recent = recentInvocations().slice(-10).reverse();
    const recentValue = recent.length === 0
      ? '_none yet_'
      : recent.map((r) => `\`${r.command}\` Δ${signedMB(r.deltaBytes)} MB · ${r.durationMs} ms · post ${toMB(r.postRssBytes)} MB`).join('\n');

    const commandsMap: Map<string, any> = (this.client as any).commands;
    const total = commandsMap?.size ?? 0;
    const loaded = commandsMap
      ? [...commandsMap.values()].filter((v: any) => v && v.__stub !== true).length
      : 0;

    const embed = new Discord.EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('RAM Stats — Silverwolf Process')
      .setDescription(`\`\`\`\nRSS (total footprint)   : ${toMB(rss)} MB\n\`\`\``)
      .addFields(
        {
          name: '📦 RSS Breakdown',
          value: [
            `**Heap (JS allocated)** \`${toMB(heapTotal)} MB\`  (${((heapTotal / rss) * 100).toFixed(1)}% of RSS)`,
            `**External (native)**   \`${toMB(external)} MB\`  *(incl. ArrayBuffers: \`${toMB(arrayBuffers)} MB\`)*`,
            `**Other (stack/libs)**  \`${toMB(other)} MB\``,
          ].join('\n'),
        },
        {
          name: '🧠 Heap Detail',
          value: [
            `**Used**  \`${toMB(heapUsed)} MB\``,
            `**Total** \`${toMB(heapTotal)} MB\``,
          ].join('\n'),
        },
        {
          name: '📚 Commands',
          value: `**Loaded** \`${loaded}\` / **Registered** \`${total}\``,
        },
        {
          name: '⚡ Recent invocations',
          value: recentValue.length > 1024 ? `${recentValue.slice(0, 1010)}…` : recentValue,
        },
      )
      .setFooter({ text: `PID ${process.pid} · uptime ${(process.uptime() / 60).toFixed(1)} min` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export default RamStats;
