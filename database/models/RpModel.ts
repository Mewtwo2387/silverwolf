import rpQueries from '../queries/rpQueries';
import { generateCharId, MAX_SPAWNS_PER_CHANNEL } from '../../utils/rpIdentity';
import { log } from '../../utils/log';
import type Database from '../Database';

export interface SpawnResult {
  ok: boolean;
  reason?: 'limit';
  /** True when the spawn was already active (a pure live reconfigure). */
  reconfigured?: boolean;
  spawnId?: number;
}

/** DAO for roleplay characters, their per-channel spawns, and private history. */
class RpModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ── Characters ──────────────────────────────────────────────────────────

  /** Generates a 6-char id not already in use (a handful of tries is plenty at 36^6). */
  private async generateUniqueCharId(): Promise<string> {
    for (let i = 0; i < 12; i += 1) {
      const candidate = generateCharId();
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.getCharacter(candidate);
      if (!existing) return candidate;
    }
    throw new Error('Could not allocate a unique character id');
  }

  async createCharacter(params: {
    creatorId: string;
    name: string;
    details: string;
    startingMessage: string;
    pfpUrl?: string | null;
    pfpMessageId?: string | null;
    pfpChannelId?: string | null;
  }): Promise<Record<string, any> | null> {
    await this.db.user.getUser(params.creatorId);
    const charId = await this.generateUniqueCharId();
    await this.db.executeQuery(rpQueries.INSERT_CHARACTER, [
      charId,
      params.creatorId,
      params.name,
      params.name.toLowerCase(),
      params.details,
      params.startingMessage,
      params.pfpUrl ?? null,
      params.pfpMessageId ?? null,
      params.pfpChannelId ?? null,
    ]);
    log(`Rp: created character ${params.name} (${charId}) by ${params.creatorId}`);
    return this.getCharacter(charId);
  }

  async getCharacter(charId: string): Promise<Record<string, any> | null> {
    return this.db.executeSelectQuery(rpQueries.GET_CHARACTER_BY_ID, [charId]);
  }

  async countCharactersByCreator(creatorId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(rpQueries.COUNT_CHARACTERS_BY_CREATOR, [creatorId]);
    return row?.count ?? 0;
  }

  /** Updates definition fields; returns false if the requester isn't the owner. */
  async updateCharacter(charId: string, creatorId: string, params: {
    name: string;
    details: string;
    startingMessage: string;
  }): Promise<boolean> {
    const res = await this.db.executeQuery(rpQueries.UPDATE_CHARACTER, [
      params.name,
      params.name.toLowerCase(),
      params.details,
      params.startingMessage,
      charId,
      creatorId,
    ]);
    return (res.changes ?? 0) > 0;
  }

  async updateCharacterPfp(charId: string, pfp: {
    url: string | null;
    messageId: string | null;
    channelId: string | null;
  }): Promise<void> {
    await this.db.executeQuery(rpQueries.UPDATE_CHARACTER_PFP, [
      pfp.url, pfp.messageId, pfp.channelId, charId,
    ]);
  }

  /** Marks the cached CDN url as broken so delivery falls back to a default avatar. */
  async clearCharacterPfpUrl(charId: string): Promise<void> {
    await this.db.executeQuery(rpQueries.CLEAR_CHARACTER_PFP_URL, [charId]);
  }

  async searchCharacters(term: string): Promise<Record<string, any>[]> {
    const cleaned = term.toLowerCase().replace(/[%_]/g, '');
    return this.db.executeSelectAllQuery(rpQueries.SEARCH_CHARACTERS, [`%${cleaned}%`, `${cleaned}%`]);
  }

  // ── Spawns ──────────────────────────────────────────────────────────────

  async getSpawn(channelId: string, charId: string): Promise<Record<string, any> | null> {
    return this.db.executeSelectQuery(rpQueries.GET_SPAWN, [channelId, charId]);
  }

  async getSpawnById(spawnId: number): Promise<Record<string, any> | null> {
    return this.db.executeSelectQuery(rpQueries.GET_SPAWN_BY_ID, [spawnId]);
  }

  async getActiveSpawnsInChannel(channelId: string): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(rpQueries.GET_ACTIVE_SPAWNS_IN_CHANNEL, [channelId]);
  }

  async getActiveAllSpawns(): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(rpQueries.GET_ACTIVE_ALL_SPAWNS, []);
  }

  /** Distinct channel ids with at least one active spawn (for the router fast-path). */
  async getDistinctActiveChannels(): Promise<string[]> {
    const rows = await this.db.executeSelectAllQuery(rpQueries.GET_DISTINCT_ACTIVE_CHANNELS, []);
    return rows.map((r) => r.channelId);
  }

  /** Role of the newest history turn, or null when there is none. */
  async getLastHistoryRole(spawnId: number): Promise<'user' | 'model' | null> {
    const row = await this.db.executeSelectQuery(rpQueries.GET_LAST_HISTORY_ROLE, [spawnId]);
    return (row?.role as 'user' | 'model') ?? null;
  }

  /**
   * Spawns (or reactivates/reconfigures) a character in a channel, enforcing the
   * per-channel cap transactionally. Reactivating a removed spawn or a brand-new
   * one counts against the cap; a pure reconfigure of an already-active spawn does not.
   */
  async trySpawn(params: {
    channelId: string;
    guildId: string;
    charId: string;
    spawnerId: string;
    interactability: 'self' | 'all';
    compactionEnabled: boolean;
  }): Promise<SpawnResult> {
    const compactionInt = params.compactionEnabled ? 1 : 0;
    const result: SpawnResult = await this.db.executeTransaction((rawDb: any) => {
      const existing = rawDb.query(rpQueries.GET_SPAWN).get(params.channelId, params.charId) as any;
      const isActive = !!existing && existing.active === 1;

      if (!isActive) {
        const countRow = rawDb.query(rpQueries.COUNT_ACTIVE_SPAWNS_IN_CHANNEL).get(params.channelId) as any;
        if ((countRow?.count ?? 0) >= MAX_SPAWNS_PER_CHANNEL) {
          return { ok: false, reason: 'limit' } as SpawnResult;
        }
      }

      if (existing) {
        rawDb.query(rpQueries.REACTIVATE_SPAWN).run(
          params.spawnerId,
          params.interactability,
          compactionInt,
          existing.spawn_id,
        );
        return { ok: true, reconfigured: isActive, spawnId: existing.spawn_id } as SpawnResult;
      }

      rawDb.query(rpQueries.INSERT_SPAWN).run(
        params.channelId,
        params.guildId,
        params.charId,
        params.spawnerId,
        params.interactability,
        compactionInt,
      );
      const newId = (rawDb.query('SELECT last_insert_rowid() AS id').get() as any).id;
      return { ok: true, reconfigured: false, spawnId: newId } as SpawnResult;
    });
    return result;
  }

  async countActiveSpawnsInChannel(channelId: string): Promise<number> {
    const row = await this.db.executeSelectQuery(rpQueries.COUNT_ACTIVE_SPAWNS_IN_CHANNEL, [channelId]);
    return row?.count ?? 0;
  }

  async deactivateSpawn(spawnId: number): Promise<void> {
    await this.db.executeQuery(rpQueries.DEACTIVATE_SPAWN, [spawnId]);
  }

  async touchSpawnActivity(spawnId: number): Promise<void> {
    await this.db.executeQuery(rpQueries.TOUCH_SPAWN_ACTIVITY, [spawnId]);
  }

  async setCompactionState(spawnId: number, memory: string, uptoId: number): Promise<void> {
    await this.db.executeQuery(rpQueries.SET_COMPACTION_STATE, [memory, uptoId, spawnId]);
  }

  async setCompactionFailed(spawnId: number, failed: boolean): Promise<void> {
    await this.db.executeQuery(rpQueries.SET_COMPACTION_FAILED, [failed ? 1 : 0, spawnId]);
  }

  async resetCompaction(spawnId: number): Promise<void> {
    await this.db.executeQuery(rpQueries.RESET_COMPACTION, [spawnId]);
  }

  // ── History ─────────────────────────────────────────────────────────────

  async addHistory(
    spawnId: number,
    role: 'user' | 'model',
    message: string,
    speaker?: { id: string | null; name: string | null },
  ): Promise<void> {
    await this.db.executeQuery(rpQueries.ADD_HISTORY, [
      spawnId, role, speaker?.id ?? null, speaker?.name ?? null, message,
    ]);
  }

  /** Un-compacted tail (rows newer than `afterId`), oldest first. */
  async getHistoryAfter(spawnId: number, afterId: number): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(rpQueries.GET_HISTORY_AFTER, [spawnId, afterId]);
  }

  async countHistory(spawnId: number): Promise<number> {
    const row = await this.db.executeSelectQuery(rpQueries.COUNT_HISTORY, [spawnId]);
    return row?.count ?? 0;
  }

  async deleteHistoryBySpawn(spawnId: number): Promise<void> {
    await this.db.executeQuery(rpQueries.DELETE_HISTORY_BY_SPAWN, [spawnId]);
  }
}

export default RpModel;
