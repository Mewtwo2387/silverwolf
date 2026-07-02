import {
  describe, it, expect, beforeAll, afterAll, beforeEach,
} from 'bun:test';
import Database from '../../database/Database';
import type RpModel from '../../database/models/RpModel';

describe('RpModel', () => {
  let db: Database;
  let rp: RpModel;
  const CHANNEL = 'chan-1';
  const GUILD = 'guild-1';

  beforeAll(async () => {
    db = new Database(`./tests/temp/testRp-${Date.now()}.db`);
    await db.ready;
    rp = db.rp;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    // Child → parent order to respect foreign keys.
    await db.executeQuery('DELETE FROM RpHistory');
    await db.executeQuery('DELETE FROM RpSpawn');
    await db.executeQuery('DELETE FROM RpCharacter');
    await db.executeQuery('DELETE FROM User');
  });

  async function makeChar(creatorId: string, name: string): Promise<string> {
    const res = await rp.createCharacter({
      creatorId, name, details: `${name} details`, startingMessage: `hi from ${name}`,
    });
    if (!res.ok) throw new Error('unexpected quota rejection while seeding a test character');
    return res.character.charId;
  }

  it('creates characters with unique ids and allows same name for different creators', async () => {
    const a = await makeChar('user-1', 'aventurine');
    const b = await makeChar('user-2', 'aventurine');
    expect(a).not.toBe(b);
    expect(await rp.countCharactersByCreator('user-1')).toBe(1);

    const fetched = await rp.getCharacter(a);
    expect(fetched!.name).toBe('aventurine');
    expect(fetched!.nameLower).toBe('aventurine');
  });

  it('enforces the per-creator cap atomically and reports a limit result', async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await rp.createCharacter({
        creatorId: 'capped', name: `cap${i}`, details: 'd', startingMessage: 's',
      }, 3);
      expect(res.ok).toBe(true);
    }
    const over = await rp.createCharacter({
      creatorId: 'capped', name: 'capX', details: 'd', startingMessage: 's',
    }, 3);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe('limit');
    expect(await rp.countCharactersByCreator('capped')).toBe(3);
  });

  it('removeSpawn deactivates and (optionally) clears history + compaction in one op', async () => {
    const id = await makeChar('user-1', 'atomic');
    const spawn = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: id, spawnerId: 'user-1', interactability: 'all', compactionEnabled: true,
    });
    const spawnId = spawn.spawnId!;
    await rp.addHistory(spawnId, 'user', 'hi', { id: 'user-2', name: 'Finch' });
    await rp.setCompactionState(spawnId, 'a memory', 1);

    await rp.removeSpawn(spawnId, true);
    expect(await rp.countActiveSpawnsInChannel(CHANNEL)).toBe(0);
    expect(await rp.countHistory(spawnId)).toBe(0);
    const row = await rp.getSpawnById(spawnId);
    expect(row!.compactedMemory).toBeNull();
    expect(row!.compactionFailed).toBe(0);
  });

  it('only the owner can update a character', async () => {
    const id = await makeChar('owner', 'sunny');
    const denied = await rp.updateCharacter(id, 'not-owner', {
      name: 'evil', details: 'x', startingMessage: 'y',
    });
    expect(denied).toBe(false);
    const ok = await rp.updateCharacter(id, 'owner', {
      name: 'sunny2', details: 'd', startingMessage: 's',
    });
    expect(ok).toBe(true);
    expect((await rp.getCharacter(id))!.name).toBe('sunny2');
  });

  it('spawns, reconfigures in place, and enforces the 5-per-channel cap', async () => {
    const ids = [];
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      ids.push(await makeChar('user-1', `char${i}`));
    }

    // First five spawn fine.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await rp.trySpawn({
        channelId: CHANNEL, guildId: GUILD, charId: ids[i], spawnerId: 'user-1', interactability: 'self', compactionEnabled: true,
      });
      expect(res.ok).toBe(true);
      expect(res.reconfigured).toBe(false);
    }
    expect(await rp.countActiveSpawnsInChannel(CHANNEL)).toBe(5);

    // Sixth distinct character is rejected.
    const sixth = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: ids[5], spawnerId: 'user-1', interactability: 'self', compactionEnabled: true,
    });
    expect(sixth.ok).toBe(false);
    expect(sixth.reason).toBe('limit');

    // Re-spawning an already-active character is a reconfigure (doesn't count against the cap).
    const reconf = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: ids[0], spawnerId: 'user-1', interactability: 'all', compactionEnabled: false,
    });
    expect(reconf.ok).toBe(true);
    expect(reconf.reconfigured).toBe(true);
    const spawn = await rp.getSpawn(CHANNEL, ids[0]);
    expect(spawn!.interactability).toBe('all');
    expect(spawn!.compactionEnabled).toBe(0);
    expect(await rp.countActiveSpawnsInChannel(CHANNEL)).toBe(5);
  });

  it('keeps history across remove + re-spawn (same spawn id), and clears it on demand', async () => {
    const id = await makeChar('user-1', 'memory');
    const first = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: id, spawnerId: 'user-1', interactability: 'all', compactionEnabled: true,
    });
    const spawnId = first.spawnId!;

    await rp.addHistory(spawnId, 'user', 'hello', { id: 'user-2', name: 'Finch' });
    await rp.addHistory(spawnId, 'model', 'hi there');
    expect(await rp.getLastHistoryRole(spawnId)).toBe('model');

    // Remove (soft) then re-spawn → same spawn id, history intact.
    await rp.deactivateSpawn(spawnId);
    expect(await rp.countActiveSpawnsInChannel(CHANNEL)).toBe(0);
    const again = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: id, spawnerId: 'user-1', interactability: 'all', compactionEnabled: true,
    });
    expect(again.spawnId).toBe(spawnId);
    expect(again.reconfigured).toBe(false); // was inactive → treated as a fresh spawn
    const tail = await rp.getHistoryAfter(spawnId, 0);
    expect(tail).toHaveLength(2);
    expect(tail[0].speakerName).toBe('Finch');

    // clear_history wipes it.
    await rp.deleteHistoryBySpawn(spawnId);
    expect(await rp.countHistory(spawnId)).toBe(0);
    expect(await rp.getLastHistoryRole(spawnId)).toBeNull();
  });

  it('only counts unanswered HUMAN turns (bot turns never trigger — the loop guard)', async () => {
    const id = await makeChar('user-1', 'listener');
    const spawn = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: id, spawnerId: 'user-1', interactability: 'all', compactionEnabled: true,
    });
    const spawnId = spawn.spawnId!;
    expect(await rp.hasUnansweredHumanTurn(spawnId)).toBe(false);

    // A human message → unanswered.
    await rp.addHistory(spawnId, 'user', 'hello', { id: 'user-2', name: 'Finch' });
    expect(await rp.hasUnansweredHumanTurn(spawnId)).toBe(true);

    // The character replies → answered.
    await rp.addHistory(spawnId, 'model', 'hi Finch');
    expect(await rp.hasUnansweredHumanTurn(spawnId)).toBe(false);

    // Another character's line (from_bot) is context only — it must NOT re-trigger a reply.
    await rp.addHistory(spawnId, 'user', 'Aventurine: evening', { id: null, name: 'Aventurine' }, true);
    expect(await rp.hasUnansweredHumanTurn(spawnId)).toBe(false);
  });

  it('tracks distinct active channels for the router fast-path', async () => {
    const id = await makeChar('user-1', 'router');
    const res = await rp.trySpawn({
      channelId: CHANNEL, guildId: GUILD, charId: id, spawnerId: 'user-1', interactability: 'self', compactionEnabled: true,
    });
    expect(await rp.getDistinctActiveChannels()).toContain(CHANNEL);
    await rp.deactivateSpawn(res.spawnId!);
    expect(await rp.getDistinctActiveChannels()).not.toContain(CHANNEL);
  });

  it('searches by name substring and id prefix', async () => {
    await makeChar('user-1', 'aventurine');
    await makeChar('user-1', 'robinbird');
    const byName = await rp.searchCharacters('venturi');
    expect(byName.some((r) => r.nameLower === 'aventurine')).toBe(true);
    const byNamePartial = await rp.searchCharacters('robin');
    expect(byNamePartial.some((r) => r.nameLower === 'robinbird')).toBe(true);
  });
});
