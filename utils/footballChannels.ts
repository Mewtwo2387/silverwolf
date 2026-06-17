import { parseChannelIds } from './parseChannelIds';

export const FOOTBALL_CHANNELS_CONFIG_KEY = 'football_channels';

export async function getFootballChannelIds(
  db: { globalConfig: { getGlobalConfig: (key: string) => Promise<string | null> } },
): Promise<string[]> {
  const dbChannels = await db.globalConfig.getGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY);
  return parseChannelIds(dbChannels ?? process.env.FOOTBALL_CHANNELS);
}
