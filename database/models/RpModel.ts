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

export type CreateCharacterResult =
  | { ok: true; character: Record<string, any> }
  | { ok: false; reason: 'limit' };

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

  /**
   * Creates a character. When `maxPerCreator` is given, the per-creator quota is
   * enforced **inside the same transaction** as the insert, so two concurrent
   * creates can't both slip past the limit. Throws (rather than silently returning a
   * phantom "not found") if the insert doesn't actually persist.
   */
  async createCharacter(params: {
    creatorId: string;
    name: string;
    details: string;
    startingMessage: string;
    pfpUrl?: string | null;
    pfpMessageId?: string | null;
    pfpChannelId?: string | null;
  }, maxPerCreator?: number): Promise<CreateCharacterResult> {
    await this.db.user.getUser(params.creatorId);
    const charId = await this.generateUniqueCharId();
    const outcome: { limited: boolean } = await this.db.executeTransaction((rawDb: any) => {
      if (typeof maxPerCreator === 'number') {
        const countRow = rawDb.query(rpQueries.COUNT_CHARACTERS_BY_CREATOR).get(params.creatorId) as any;
        if ((countRow?.count ?? 0) >= maxPerCreator) return { limited: true };
      }
      const res = rawDb.query(rpQueries.INSERT_CHARACTER).run(
        charId,
        params.creatorId,
        params.name,
        params.name.toLowerCase(),
        params.details,
        params.startingMessage,
        params.pfpUrl ?? null,
        params.pfpMessageId ?? null,
        params.pfpChannelId ?? null,
      );
      if ((res?.changes ?? 0) !== 1) {
        throw new Error(`Failed to create RP character ${params.name} (${charId})`);
      }
      return { limited: false };
    });

    if (outcome.limited) return { ok: false, reason: 'limit' };
    const created = await this.getCharacter(charId);
    if (!created) throw new Error(`RP character ${charId} was inserted but could not be reloaded`);
    log(`Rp: created character ${params.name} (${charId}) by ${params.creatorId}`);
    return { ok: true, character: created };
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

  /** Search scoped to one creator, so the owner's matches aren't crowded out of the top-25. */
  async searchOwnCharacters(creatorId: string, term: string): Promise<Record<string, any>[]> {
    const cleaned = term.toLowerCase().replace(/[%_]/g, '');
    return this.db.executeSelectAllQuery(
      rpQueries.SEARCH_OWN_CHARACTERS,
      [creatorId, `%${cleaned}%`, `${cleaned}%`],
    );
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
   * True when a human (non-bot) user turn is still waiting on a reply. Bot/webhook
   * turns never count, so a character hears other bots/characters without the
   * proactive scheduler triggering an endless back-and-forth.
   */
  async hasUnansweredHumanTurn(spawnId: number): Promise<boolean> {
    const row = await this.db.executeSelectQuery(rpQueries.HAS_UNANSWERED_HUMAN_TURN, [spawnId, spawnId]);
    return !!(row?.has);
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

  /**
   * Removes a spawn (soft-delete), optionally wiping its history + compaction state,
   * as one atomic transaction so a mid-way failure can't leave it half-cleared.
   */
  async removeSpawn(spawnId: number, clearHistory: boolean): Promise<void> {
    await this.db.executeTransaction((rawDb: any) => {
      rawDb.query(rpQueries.DEACTIVATE_SPAWN).run(spawnId);
      if (clearHistory) {
        rawDb.query(rpQueries.DELETE_HISTORY_BY_SPAWN).run(spawnId);
        rawDb.query(rpQueries.RESET_COMPACTION).run(spawnId);
      }
      return undefined;
    });
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
    fromBot = false,
  ): Promise<void> {
    await this.db.executeQuery(rpQueries.ADD_HISTORY, [
      spawnId, role, speaker?.id ?? null, speaker?.name ?? null, message, fromBot ? 1 : 0,
    ]);
  }

  /** Un-compacted tail (rows newer than `afterId`), oldest first. */
  async getHistoryAfter(spawnId: number, afterId: number): Promise<Record<string, any>[]> {
    return this.db.executeSelectAllQuery(rpQueries.GET_HISTORY_AFTER, [spawnId, afterId]);
  }

  /** Whole-table history footprint (row count + total message bytes) for diagnostics. */
  async getHistoryStats(): Promise<{ count: number; bytes: number }> {
    const row = await this.db.executeSelectQuery(rpQueries.HISTORY_STATS, []);
    return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
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
