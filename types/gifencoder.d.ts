declare module 'gifencoder' {
  import { Writable } from 'stream';

  class GIFEncoder {
    constructor(width: number, height: number);
    createReadStream(): NodeJS.ReadableStream;
    createWriteStream(options?: Record<string, unknown>): Writable;
    start(): void;
    finish(): void;
    setRepeat(repeat: number): void;
    setDelay(ms: number): void;
    setQuality(quality: number): void;
    setFrameRate(fps: number): void;
    setDispose(dispose: number): void;
    setTransparent(color: number): void;
    addFrame(ctx: unknown): void;
  }

  export = GIFEncoder;
}
