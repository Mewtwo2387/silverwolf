// Serialize concurrent calls for the same user through a per-user promise chain.
//
// Each surface keeps its own module-level `Map<userId, Promise>` and routes its
// process* entry point through this helper. We capture the previous in-flight
// promise and register our own `run` synchronously in the same tick, so two
// callers arriving back-to-back are guaranteed to chain rather than both observe
// an empty slot and race through the inner work. (A `while (existing) await existing`
// loop that re-reads the map after awaiting can let callers resume in parallel as
// soon as a predecessor settles — this avoids that.)
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
