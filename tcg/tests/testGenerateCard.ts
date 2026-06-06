import fs from 'fs';
import path from 'path';
import { CHARACTERS } from '../characters';
import { characterCardPath, characterSlugFromName, tcgAssetPaths } from '../assetPaths';
import { removeStaleCardOutputs } from '../cardGenerateCleanup';

async function testGenerateCard() {
  const outDir = tcgAssetPaths.characters.cards;
  const expectedSlugs = new Set(CHARACTERS.map((character) => characterSlugFromName(character.name)));
  fs.mkdirSync(outDir, { recursive: true });
  for (const character of CHARACTERS) {
    const canvas = await character.generateCard();
    const buffer = canvas.toBuffer('image/png') as Buffer;
    const outPath = characterCardPath(characterSlugFromName(character.name));
    fs.writeFileSync(path.resolve(outPath), buffer);
    console.log(`Wrote ${outPath}`);
  }
  removeStaleCardOutputs(outDir, expectedSlugs);
}

testGenerateCard().catch((error) => {
  console.error('Failed to generate card:', error);
  process.exitCode = 1;
});
