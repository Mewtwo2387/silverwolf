import { parseChannelIds } from './parseChannelIds';
import { GLOBAL_CONFIG_KEYS } from './globalConfig';

export const FOOTBALL_CHANNELS_CONFIG_KEY = GLOBAL_CONFIG_KEYS.FOOTBALL_CHANNELS;
/** Global kill-switch: `0` = off, `1` = on. Unset defaults to on. */
export const FOOTBALL_ENABLED_CONFIG_KEY = GLOBAL_CONFIG_KEYS.FOOTBALL;

type GlobalConfigReader = {
  globalConfig: { getGlobalConfig: (key: string) => Promise<string | null> };
};

export async function isFootballEnabled(db: GlobalConfigReader): Promise<boolean> {
  const raw = await db.globalConfig.getGlobalConfig(FOOTBALL_ENABLED_CONFIG_KEY);
  if (raw === null || raw === undefined || raw === '') return true;
  if (raw === '0' || raw.toLowerCase() === 'false') return false;
  if (raw === '1' || raw.toLowerCase() === 'true') return true;
  return true;
}

export async function getFootballChannelIds(db: GlobalConfigReader): Promise<string[]> {
  const dbChannels = await db.globalConfig.getGlobalConfig(FOOTBALL_CHANNELS_CONFIG_KEY);
  return parseChannelIds(dbChannels ?? process.env.FOOTBALL_CHANNELS);
}
