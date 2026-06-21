import { parseChannelIds } from './parseChannelIds';

export const SERVER_CONFIG_KEYS = {
  POKEMON_SPAWN_RATE: 'pokemon_spawn_rate',
  POKEMON_SHINY_CHANCE: 'pokemon_shiny_chance',
  POKEMON_MYSTERY_CHANCE: 'pokemon_mystery_chance',
  SERIOUS_CHANNELS: 'serious_channels',
} as const;

export const SERVER_CHANNEL_LIST_KEYS = [
  SERVER_CONFIG_KEYS.SERIOUS_CHANNELS,
] as const;

export type ServerChannelListKey = typeof SERVER_CHANNEL_LIST_KEYS[number];

export const SERVER_CHANNEL_KEY_PREFIX = 'channel:';

export const SERVER_ROLE_KEY_PREFIX = 'role:';

export function serverChannelKey(channelName: string): string {
  return `${SERVER_CHANNEL_KEY_PREFIX}${channelName}`;
}

export function serverRoleKey(roleName: string): string {
  return `${SERVER_ROLE_KEY_PREFIX}${roleName}`;
}

export function isServerChannelListKey(key: string): key is ServerChannelListKey {
  return (SERVER_CHANNEL_LIST_KEYS as readonly string[]).includes(key);
}

export type DocumentedServerConfigKey = typeof SERVER_CONFIG_KEYS[keyof typeof SERVER_CONFIG_KEYS];

export const DOCUMENTED_SERVER_CONFIG_KEYS: {
  key: DocumentedServerConfigKey;
  description: string;
  defaultValue: string;
}[] = [
  {
    key: SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE,
    description: 'Per-message Pokémon spawn probability (0–1)',
    defaultValue: '0.01',
  },
  {
    key: SERVER_CONFIG_KEYS.POKEMON_SHINY_CHANCE,
    description: 'Shiny variant chance when a Pokémon spawns (0–1)',
    defaultValue: '0.03',
  },
  {
    key: SERVER_CONFIG_KEYS.POKEMON_MYSTERY_CHANCE,
    description: 'Mystery variant chance when a Pokémon spawns (0–1)',
    defaultValue: '0.3',
  },
  {
    key: SERVER_CONFIG_KEYS.SERIOUS_CHANNELS,
    description: 'Comma-separated channel IDs excluded from spawns and some keyword triggers',
    defaultValue: '(none)',
  },
];

/** Keys managed via `/serverconfig setvalue`. */
export const SETTABLE_VALUE_KEYS = DOCUMENTED_SERVER_CONFIG_KEYS.filter(
  (entry) => entry.key !== SERVER_CONFIG_KEYS.SERIOUS_CHANNELS,
);

const DOCUMENTED_KEY_SET = new Set<string>(DOCUMENTED_SERVER_CONFIG_KEYS.map((entry) => entry.key));

const DEFAULT_RATES: Record<string, number> = {
  [SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE]: 0.01,
  [SERVER_CONFIG_KEYS.POKEMON_SHINY_CHANCE]: 0.03,
  [SERVER_CONFIG_KEYS.POKEMON_MYSTERY_CHANCE]: 0.3,
};

/** Parsed server config values used at runtime (defaults applied when unset). */
export interface ResolvedServerConfig {
  pokemonSpawnRate: number;
  pokemonShinyChance: number;
  pokemonMysteryChance: number;
  seriousChannelIds: string[];
}

type ServerConfigReader = {
  serverConfig: {
    getAllServerConfig: (serverId: string) => Promise<Record<string, any>[]>;
  };
};

function parseRate(raw: string | null | undefined, defaultValue: number): number {
  if (raw === null || raw === undefined || raw === '') return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return defaultValue;
  return value;
}

export function isDocumentedServerConfigKey(key: string): key is DocumentedServerConfigKey {
  return DOCUMENTED_KEY_SET.has(key);
}

export function validateServerConfigValue(key: string, value: string): string | null {
  if (!isDocumentedServerConfigKey(key)) {
    return `Unknown key. Supported keys: ${DOCUMENTED_SERVER_CONFIG_KEYS.map((entry) => entry.key).join(', ')}`;
  }

  if (key === SERVER_CONFIG_KEYS.SERIOUS_CHANNELS) {
    if (!value.trim()) return null;
    const ids = parseChannelIds(value);
    if (ids.length === 0) return 'serious_channels must be a comma-separated list of numeric channel IDs';
    if (ids.some((id) => !/^\d+$/.test(id))) return 'serious_channels must contain only numeric channel IDs';
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    return `${key} must be a number between 0 and 1`;
  }
  return null;
}

export function formatChannelListValue(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'none';
  const ids = parseChannelIds(raw);
  return ids.length > 0 ? ids.map((id) => `<#${id}>`).join(', ') : 'none';
}

export function formatServerConfigOverview(rows: { key: string; value: string }[]): string {
  const valueByKey = new Map(rows.map((row) => [row.key, row.value]));

  const lines: string[] = [];

  lines.push('**Values**');
  SETTABLE_VALUE_KEYS.forEach((entry) => {
    const raw = valueByKey.get(entry.key);
    lines.push(`${entry.key}: ${raw?.trim() ? raw : 'none'}`);
  });

  lines.push('', '**Channel lists**');
  SERVER_CHANNEL_LIST_KEYS.forEach((listKey) => {
    lines.push(`${listKey}: ${formatChannelListValue(valueByKey.get(listKey))}`);
  });

  const roleRows = rows.filter((row) => row.key.startsWith(SERVER_ROLE_KEY_PREFIX));
  lines.push('', '**Roles**');
  if (roleRows.length === 0) {
    lines.push('none');
  } else {
    roleRows.forEach((row) => {
      const name = row.key.slice(SERVER_ROLE_KEY_PREFIX.length);
      lines.push(`${name}: <@&${row.value}>`);
    });
  }

  const channelRows = rows.filter((row) => row.key.startsWith(SERVER_CHANNEL_KEY_PREFIX));
  lines.push('', '**Channels**');
  if (channelRows.length === 0) {
    lines.push('none');
  } else {
    channelRows.forEach((row) => {
      const name = row.key.slice(SERVER_CHANNEL_KEY_PREFIX.length);
      lines.push(`${name}: <#${row.value}>`);
    });
  }

  return lines.join('\n');
}

export async function loadResolvedServerConfig(
  db: ServerConfigReader,
  serverId: string,
): Promise<ResolvedServerConfig> {
  const rows = await db.serverConfig.getAllServerConfig(serverId);
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    pokemonSpawnRate: parseRate(values.get(SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE), DEFAULT_RATES[SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE]),
    pokemonShinyChance: parseRate(values.get(SERVER_CONFIG_KEYS.POKEMON_SHINY_CHANCE), DEFAULT_RATES[SERVER_CONFIG_KEYS.POKEMON_SHINY_CHANCE]),
    pokemonMysteryChance: parseRate(values.get(SERVER_CONFIG_KEYS.POKEMON_MYSTERY_CHANCE), DEFAULT_RATES[SERVER_CONFIG_KEYS.POKEMON_MYSTERY_CHANCE]),
    seriousChannelIds: parseChannelIds(values.get(SERVER_CONFIG_KEYS.SERIOUS_CHANNELS)),
  };
}
