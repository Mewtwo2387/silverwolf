declare module 'gif-frames' {
  interface GifFrameOptions {
    url: string | Buffer;
    frames?: number | number[] | string;
    outputType?: string;
    cumulative?: boolean;
  }

  interface FrameData {
    frameIndex: number;
    frameInfo: Record<string, unknown>;
    getImage(): NodeJS.ReadableStream & { width: number; height: number };
  }

  function gifFrames(options: GifFrameOptions): Promise<FrameData[]>;

  export = gifFrames;
}
