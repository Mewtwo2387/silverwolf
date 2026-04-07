import fs from 'fs';
import { CHARACTERS } from '../characters';

/**
 * Generate PNG card images for every character in `CHARACTERS` and save them to disk.
 *
 * For each character this calls `character.generateCard()`, converts the resulting canvas to a PNG buffer,
 * and writes it to `./tcg/assets/cards/` using the character name lowercased with whitespace collapsed to underscores
 * (e.g. `Character Name` -> `character_name.png`). Existing files with the same names are overwritten.
 */
async function testGenerateCard() {
  for (const character of CHARACTERS) {
    const canvas = await character.generateCard();
    const buffer = canvas.toBuffer('image/png') as Buffer;
    fs.writeFileSync(`./tcg/assets/cards/${character.name.toLowerCase().replace(/\s+/g, '_')}.png`, buffer);
  }
}

testGenerateCard().catch((error) => {
  console.error('Failed to generate card:', error);
  process.exitCode = 1;
});
