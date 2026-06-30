import { runProactiveRpTick } from '../utils/rpRuntime';
import { log, logError } from '../utils/log';

/** Drives proactive "all"-mode roleplay replies — one scan every 30s. */
const RP_TICK_MS = 30_000;

class RpScheduler {
  private client: any;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(client: any) {
    this.client = client;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      runProactiveRpTick(this.client).catch((err) => logError('Rp: proactive tick failed:', err));
    }, RP_TICK_MS);
    log(`Rp scheduler started (every ${RP_TICK_MS / 1000}s).`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export default RpScheduler;
