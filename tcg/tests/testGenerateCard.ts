import fs from 'fs';
import { KAITLIN } from '../characters';

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/assets/cards/kaitlin.png', buffer);
}

testGenerateCard().catch((error) => {
  console.error('Failed to generate card:', error);
  process.exitCode = 1;
});
