import fs from 'fs';
import path from 'path';
import { ALL_ITEMS } from '../items';
import { itemCardPath, tcgAssetPaths } from '../assetPaths';

async function testGenerateItemCard() {
  const outDir = tcgAssetPaths.items.cards;
  fs.mkdirSync(outDir, { recursive: true });
  for (const item of ALL_ITEMS) {
    const canvas = await item.generateCard();
    const buffer = canvas.toBuffer('image/png') as Buffer;
    const outPath = itemCardPath(item.id);
    fs.writeFileSync(path.resolve(outPath), buffer);
    console.log(`Wrote ${outPath}`);
  }
}

testGenerateItemCard().catch((error) => {
  console.error('Failed to generate item card:', error);
  process.exitCode = 1;
});
