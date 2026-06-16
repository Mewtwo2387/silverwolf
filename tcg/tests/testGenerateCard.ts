import fs from 'fs';
import path from 'path';
import { CHARACTERS } from '../characters';
import { characterCardPath, tcgAssetPaths } from '../assetPaths';
import { removeStaleCardOutputs } from '../cardGenerateCleanup';

async function testGenerateCard() {
  const outDir = tcgAssetPaths.characters.cards;
  const expectedSlugs = new Set(CHARACTERS.map((character) => character.slug));
  if (expectedSlugs.size !== CHARACTERS.length) {
    throw new Error(
      `Duplicate character slugs detected: ${CHARACTERS.length} characters but only ${expectedSlugs.size} unique slugs`,
    );
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const character of CHARACTERS) {
    const canvas = await character.generateCard();
    const buffer = canvas.toBuffer('image/png') as Buffer;
    const outPath = characterCardPath(character.slug);
    fs.writeFileSync(path.resolve(outPath), buffer);
    console.log(`Wrote ${outPath}`);
  }
  removeStaleCardOutputs(outDir, expectedSlugs);
}

testGenerateCard().catch((error) => {
  console.error('Failed to generate card:', error);
  process.exitCode = 1;
});
