import Database from '../../database/Database';
import {
  formatChannelListValue,
  formatServerConfigOverview,
  loadResolvedServerConfig,
  SERVER_CONFIG_KEYS,
  validateServerConfigValue,
} from '../../utils/serverConfig';

describe('serverConfig utils', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database(`./tests/temp/testServerConfigUtil-${Date.now()}.db`);
    await db.ready;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM ServerConfig');
  });

  it('returns documented defaults when keys are unset', async () => {
    const config = await loadResolvedServerConfig(db, '123456789');
    expect(config.pokemonSpawnRate).toBe(0.01);
    expect(config.pokemonShinyChance).toBe(0.03);
    expect(config.pokemonMysteryChance).toBe(0.3);
    expect(config.seriousChannelIds).toEqual([]);
  });

  it('loads configured values for a server', async () => {
    const serverId = '123456789';
    await db.serverConfig.setServerConfig(serverId, SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE, '0.05');
    await db.serverConfig.setServerConfig(serverId, SERVER_CONFIG_KEYS.POKEMON_SHINY_CHANCE, '0.1');
    await db.serverConfig.setServerConfig(serverId, SERVER_CONFIG_KEYS.POKEMON_MYSTERY_CHANCE, '0.2');
    await db.serverConfig.setServerConfig(serverId, SERVER_CONFIG_KEYS.SERIOUS_CHANNELS, '111, 222');

    const config = await loadResolvedServerConfig(db, serverId);
    expect(config.pokemonSpawnRate).toBe(0.05);
    expect(config.pokemonShinyChance).toBe(0.1);
    expect(config.pokemonMysteryChance).toBe(0.2);
    expect(config.seriousChannelIds).toEqual(['111', '222']);
  });

  it('falls back to defaults for invalid numeric values', async () => {
    const serverId = '123456789';
    await db.serverConfig.setServerConfig(serverId, SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE, '2');

    const config = await loadResolvedServerConfig(db, serverId);
    expect(config.pokemonSpawnRate).toBe(0.01);
  });

  describe('validateServerConfigValue', () => {
    it('accepts valid rates and channel lists', () => {
      expect(validateServerConfigValue(SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE, '0.02')).toBeNull();
      expect(validateServerConfigValue(SERVER_CONFIG_KEYS.SERIOUS_CHANNELS, '123,456')).toBeNull();
      expect(validateServerConfigValue(SERVER_CONFIG_KEYS.SERIOUS_CHANNELS, '')).toBeNull();
    });

    it('rejects invalid values', () => {
      expect(validateServerConfigValue(SERVER_CONFIG_KEYS.POKEMON_SPAWN_RATE, '1.5')).not.toBeNull();
      expect(validateServerConfigValue(SERVER_CONFIG_KEYS.SERIOUS_CHANNELS, 'abc')).not.toBeNull();
      expect(validateServerConfigValue('unknown_key', '0.1')).not.toBeNull();
    });
  });

  describe('formatServerConfigOverview', () => {
    it('shows none for unset values and formats roles and channels', () => {
      const overview = formatServerConfigOverview([
        { key: 'pokemon_spawn_rate', value: '0.05' },
        { key: 'role:girl', value: '111111111' },
        { key: 'channel:announcements', value: '222222222' },
        { key: 'serious_channels', value: '333333333,444444444' },
      ]);

      expect(overview).toContain('pokemon_spawn_rate: 0.05');
      expect(overview).toContain('pokemon_shiny_chance: none');
      expect(overview).toContain('serious_channels: <#333333333>, <#444444444>');
      expect(overview).toContain('girl: <@&111111111>');
      expect(overview).toContain('announcements: <#222222222>');
    });

    it('shows none for empty role and channel sections', () => {
      const overview = formatServerConfigOverview([]);
      expect(overview).toContain('**Roles**\nnone');
      expect(overview).toContain('**Channels**\nnone');
      expect(overview).toContain('serious_channels: none');
    });
  });

  describe('formatChannelListValue', () => {
    it('returns none for empty values', () => {
      expect(formatChannelListValue(null)).toBe('none');
      expect(formatChannelListValue('')).toBe('none');
    });
  });
});
