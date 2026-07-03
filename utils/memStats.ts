import fs from 'fs';
import path from 'path';
import { getRpRuntimeStats } from './rpRuntime';
import { getRpWebhookIdCount } from './rpDelivery';
import { getAvatarUrlCacheSize } from './rpAvatar';

/**
 * Memory diagnostics for the /memstats dev command. Collects process memory,
 * discord.js cache sizes, the RP feature's in-memory state, and DB footprint so a
 * leak can be localised (JS heap vs native, which cache, or just DB/log growth)
 * without attaching an inspector to the prod container.
 */

const DB_PATH = path.join(import.meta.dir, '../persistence/database.db');

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export async function collectMemStats(client: any, forceGc = false): Promise<string> {
  const before = process.memoryUsage();
  if (forceGc) Bun.gc(true);
  const mem = forceGc ? process.memoryUsage() : before;

  // discord.js caches
  let messageCacheTotal = 0;
  let memberCacheTotal = 0;
  for (const channel of client.channels.cache.values()) {
    messageCacheTotal += (channel as any).messages?.cache?.size ?? 0;
  }
  for (const guild of client.guilds.cache.values()) {
    memberCacheTotal += (guild as any).members?.cache?.size ?? 0;
  }

  const rp = getRpRuntimeStats();
  const rpHistory = await client.db.rp.getHistoryStats();

  const lines = [
    `**Process memory**${forceGc ? ' (after forced GC)' : ''}`,
    `rss: ${mb(mem.rss)} | heapUsed: ${mb(mem.heapUsed)} | heapTotal: ${mb(mem.heapTotal)}`,
    `external: ${mb(mem.external)} | arrayBuffers: ${mb(mem.arrayBuffers)}`,
  ];
  if (forceGc) {
    lines.push(`freed by GC: rss ${mb(before.rss - mem.rss)}, heapUsed ${mb(before.heapUsed - mem.heapUsed)}`);
  }
  lines.push(
    '',
    '**discord.js caches**',
    `guilds: ${client.guilds.cache.size} | channels: ${client.channels.cache.size} | users: ${client.users.cache.size}`,
    `messages (all channels): ${messageCacheTotal} | members (all guilds): ${memberCacheTotal}`,
    '',
    '**Roleplay in-memory state**',
    `activeRpChannels: ${rp.activeChannels} | inFlightSpawns: ${rp.inFlightSpawns}`
      + ` | rpWebhookIds: ${getRpWebhookIdCount()} | avatarUrlCache: ${getAvatarUrlCacheSize()}`,
    '',
    '**Tracked message history**',
    `deletedMessages: ${client.deletedMessages?.length ?? 0} | editedMessages: ${client.editedMessages?.length ?? 0}`,
    '',
    '**Persistence**',
    `database.db: ${mb(fileSize(DB_PATH))}`
      + ` | RpHistory rows: ${rpHistory.count.toLocaleString()} (${mb(rpHistory.bytes)} of message text)`,
  );
  return lines.join('\n');
}
