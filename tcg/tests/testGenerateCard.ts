import fs from 'fs';
import { CHARACTERS } from '../characters';

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
