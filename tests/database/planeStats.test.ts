import Database from '../../database/Database';
import type PlaneStatsModel from '../../database/models/PlaneStatsModel';

// The browser posts semantic gameplay events; this model is the trust boundary.
// These tests pin the rules that keep a forged event from minting medals.
describe('PlaneStatsModel', () => {
  let db: Database;
  let planeStats: PlaneStatsModel;
  const userId = '123456789';

  beforeAll(async () => {
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testPlaneStats-${timestamp}.db`);
    await db.ready;
    planeStats = db.planeStats;
  });

  afterAll(() => {
    db.db.close();
  });

  beforeEach(async () => {
    await db.executeQuery('DELETE FROM PlaneStats');
    await db.executeQuery('DELETE FROM User');
  });

  describe('getStats', () => {
    it('returns a fresh, fully-shaped blob for an unknown user', async () => {
      const stats = await planeStats.getStats('nobody');
      expect(stats.kills).toBe(0);
      expect(stats.stuntBest).toBe(0);
      expect(stats.ironHull).toBe(false);
      expect(stats.flawlessCanyon).toBe(false);
    });
  });

  describe('applyEvents', () => {
    it('records a legitimate hard-difficulty sortie clear', async () => {
      const stats = await planeStats.applyEvents(userId, [
        {
          t: 'sortieClear', map: 'coastal', diff: 'hard', hullPct: 100, bandits: 5, tookDamage: false,
        },
      ]);
      expect(stats.clearCoastalHard).toBe(true);
      expect(stats.ironHull).toBe(true);
      expect(stats.noDamageAce).toBe(true);
      expect(stats.aceInFlight).toBe(true);
      expect(stats.outnumberedAce).toBe(true);
    });

    it('rejects out-of-range numbers instead of clamping them into evidence', async () => {
      const stats = await planeStats.applyEvents(userId, [
        {
          t: 'sortieClear', map: 'ocean', diff: 'normal', hullPct: 101, bandits: 99, tookDamage: true,
        },
      ]);
      // The clear itself is real, but 101% hull and 99 bandits are not: clamping
      // them to 100 / 5 would have granted Iron Hull and Ace in a Flight.
      expect(stats.clearOceanNormal).toBe(true);
      expect(stats.ironHull).toBe(false);
      expect(stats.aceInFlight).toBe(false);
      expect(stats.outnumberedAce).toBe(false);
    });

    it('rejects fractional counters', async () => {
      const stats = await planeStats.applyEvents(userId, [
        {
          t: 'stuntRun', course: 'canyon', score: 1200.5, ringsTotal: 30, ringsHit: 30, bullseyes: 2.5,
        },
      ]);
      expect(stats.firstStunt).toBe(true);
      expect(stats.stuntBest).toBe(0); // 1200.5 is not a score
      expect(stats.bullseyes).toBe(0); // nor is 2.5 a count of bullseyes
      expect(stats.flawlessCanyon).toBe(true); // the ring counts were whole
    });

    it('ignores unknown event types and malformed entries', async () => {
      const stats = await planeStats.applyEvents(userId, [
        { t: 'grantEverything' }, null, 'kill', 42, { t: 'kill', mode: 'sortie', diff: 'nightmare' },
      ]);
      expect(stats.kills).toBe(0);
      expect(stats.firstKill).toBe(false);
    });

    it('persists across calls and keeps the best stunt score', async () => {
      await planeStats.applyEvents(userId, [{
        t: 'stuntRun', course: 'valley', score: 900, ringsTotal: 31, ringsHit: 20, bullseyes: 3,
      }]);
      const stats = await planeStats.applyEvents(userId, [{
        t: 'stuntRun', course: 'valley', score: 400, ringsTotal: 31, ringsHit: 25, bullseyes: 2,
      }]);
      expect(stats.stuntBest).toBe(900);
      expect(stats.bullseyes).toBe(5);
      expect((await planeStats.getStats(userId)).stuntBest).toBe(900);
    });

    it('does not lose medals when two batches land at once', async () => {
      // Both calls read-modify-write the same blob; without the transaction the
      // later UPSERT would drop the earlier one's flag. (The User row is created
      // up front: a first-ever concurrent create is a separate, pre-existing
      // race in UserModel and not what this test is about.)
      await db.user.getUser(userId);
      await Promise.all([
        planeStats.applyEvents(userId, [{ t: 'tutorial', id: 'takeoff' }]),
        planeStats.applyEvents(userId, [{ t: 'tutorial', id: 'bombs' }]),
      ]);
      const stats = await planeStats.getStats(userId);
      expect(stats.tutTakeoff).toBe(true);
      expect(stats.tutBombs).toBe(true);
    });
  });
});
