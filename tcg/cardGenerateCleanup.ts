import fs from 'fs';
import path from 'path';

/** Deletes `.png` files in `outDir` whose basename is not in `expectedBasenames`. */
export function removeStaleCardOutputs(outDir: string, expectedBasenames: Set<string>): void {
  if (!fs.existsSync(outDir)) {
    return;
  }
  for (const file of fs.readdirSync(outDir)) {
    if (!file.endsWith('.png')) {
      continue;
    }
    const basename = file.slice(0, -4);
    if (expectedBasenames.has(basename)) {
      continue;
    }
    const filePath = path.join(outDir, file);
    fs.unlinkSync(filePath);
    console.log(`Removed stale ${filePath}`);
  }
}
