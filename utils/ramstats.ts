import { log } from './log';

const IDLE_FIRST_SAMPLE_MS = 30_000;
const IDLE_INTERVAL_MS = 10 * 60 * 1000;
const RING_CAPACITY = 50;

export interface InvocationSample {
  command: string;
  preRssBytes: number;
  postRssBytes: number;
  deltaBytes: number;
  durationMs: number;
  startedAt: number;
}

const ring: InvocationSample[] = [];

export function recordInvocation(sample: InvocationSample): void {
  ring.push(sample);
  if (ring.length > RING_CAPACITY) ring.shift();
}

export function recentInvocations(): InvocationSample[] {
  return ring.slice();
}

function logIdleSnapshot(label: string): void {
  const m = process.memoryUsage();
  log(`[ramstats][idle:${label}] rss=${m.rss} heapTotal=${m.heapTotal} heapUsed=${m.heapUsed} external=${m.external} arrayBuffers=${m.arrayBuffers}`);
}

let started = false;
export function startIdleSampler(): void {
  if (started) return;
  started = true;
  setTimeout(() => logIdleSnapshot('settle'), IDLE_FIRST_SAMPLE_MS).unref?.();
  setInterval(() => logIdleSnapshot('periodic'), IDLE_INTERVAL_MS).unref?.();
}
