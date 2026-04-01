// Minimal bun:sqlite module declarations for TypeScript
declare module 'bun:sqlite' {
  export interface SQLiteOptions {
    create?: boolean;
    readonly?: boolean;
    readwrite?: boolean;
  }

  export interface Statement<T = unknown> {
    run(...params: any[]): void;
    get(...params: any[]): T | null;
    all(...params: any[]): T[];
    finalize(): void;
  }

  export class Database {
    constructor(path: string, options?: SQLiteOptions);
    run(sql: string, ...params: any[]): void;
    query<T = unknown>(sql: string): Statement<T>;
    close(): void;
  }
}

// Bun-specific extensions to ImportMeta
interface ImportMeta {
  /** Absolute path to the directory of the current file (Bun only) */
  dir: string;
  /** Absolute path to the current file (Bun only) */
  file: string;
  /** Absolute path to the current file (Bun only) */
  path: string;
}
