// Bun-specific extensions to ImportMeta
interface ImportMeta {
  /** Absolute path to the directory of the current file (Bun only) */
  dir: string;
  /** Absolute path to the current file (Bun only) */
  file: string;
  /** Absolute path to the current file (Bun only) */
  path: string;
}
