// One shared registry of in-flight per-user operations. All economy mutations
// (claim, eat, buy upgrade, buy ascension upgrade, ascend) chain through this so
// the same user can't run two of them concurrently — they read-check-write the
// same balances non-atomically, so a per-module lock would still let, say, an
// eat and a buy overspend the same dinonuggies. None of these processors call
// another, so a single global chain can't deadlock.
export const userLocks = new Map<string, Promise<any>>();

// Serialize concurrent calls for the same user through a per-user promise chain.
//
// Callers should pass the shared `userLocks` registry above rather than a private
// per-module map, so every economy mutation for a user chains on the same key and
// can't race. We capture the previous in-flight promise and register our own `run`
// synchronously in the same tick, so two callers arriving back-to-back are
// guaranteed to chain rather than both observe an empty slot and race through the
// inner work. (A `while (existing) await existing` loop that re-reads the map after
// awaiting can let callers resume in parallel as soon as a predecessor settles —
// this avoids that.)
export function withUserLock<T>(
  locks: Map<string, Promise<any>>,
  userId: string,
  inner: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(userId);
  const run: Promise<T> = (async () => {
    if (previous) await previous.catch(() => undefined);
    return inner();
  })();
  locks.set(userId, run);
  return (async () => {
    try {
      return await run;
    } finally {
      if (locks.get(userId) === run) locks.delete(userId);
    }
  })();
}
