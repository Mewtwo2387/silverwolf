import { describe, test, expect } from 'bun:test';
import BabyScheduler from '../../classes/babyScheduler';

/** A scheduler whose baby list is fixed and whose per-baby work is stubbed,
 *  so the only thing under test is how the loop reacts to one baby failing. */
function schedulerWith(babies: any[]) {
  const scheduler: any = new BabyScheduler({
    db: { baby: { getAllBabies: async () => babies } },
  });
  const handled: string[] = [];
  const stub = (baby: any) => {
    if (baby.explode) throw new Error(`boom for ${baby.name}`);
    handled.push(baby.name);
    return Promise.resolve();
  };
  scheduler.dailyNuggieClaim = stub;
  scheduler.dailyPing = stub;
  scheduler.tenMinuteGamble = stub;
  return { scheduler, handled: () => handled };
}

const born = (name: string, job: string, explode = false) => ({
  id: name, name, status: 'born', job, explode,
});

describe('babyScheduler per-baby isolation', () => {
  test('a failing baby does not stop the ones after it (daily)', async () => {
    const { scheduler, handled } = schedulerWith([
      born('first', 'nuggieClaimer'),
      born('exploding', 'nuggieClaimer', true),
      born('third', 'pinger'),
    ]);

    await scheduler.dailyAutomations();

    // Without per-baby catches the throw would abort the loop and 'third'
    // would silently miss its automation for the day.
    expect(handled()).toEqual(['first', 'third']);
  });

  test('a failing baby does not stop the ones after it (ten-minute)', async () => {
    const { scheduler, handled } = schedulerWith([
      born('exploding', 'gambler', true),
      born('second', 'gambler'),
    ]);

    await scheduler.tenMinuteAutomations();

    expect(handled()).toEqual(['second']);
  });

  test('a failure to load the baby list still propagates to the caller', async () => {
    // The scheduler's own try/catch is the right place for this one — there is
    // no per-baby work to isolate if the list never arrived.
    const scheduler: any = new BabyScheduler({
      db: { baby: { getAllBabies: async () => { throw new Error('db down'); } } },
    });

    await expect(scheduler.dailyAutomations()).rejects.toThrow('db down');
  });

  test('babies that are not born are skipped without running work', async () => {
    const { scheduler, handled } = schedulerWith([
      {
        id: 'unborn', name: 'unborn', status: 'pending', job: 'nuggieClaimer',
      },
      born('born', 'nuggieClaimer'),
    ]);

    await scheduler.dailyAutomations();

    expect(handled()).toEqual(['born']);
  });
});
