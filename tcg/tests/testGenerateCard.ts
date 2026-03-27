import fs from 'fs';
import { KAITLIN, SILVERWOLF } from '../characters';

async function testGenerateCard() {
  const canvas = await KAITLIN.generateCard();
  const buffer = canvas.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/assets/cards/kaitlin.png', buffer);
  const canvas2 = await SILVERWOLF.generateCard();
  const buffer2 = canvas2.toBuffer('image/png') as Buffer;
  fs.writeFileSync('./tcg/assets/cards/silverwolf.png', buffer2);
}

testGenerateCard().catch((error) => {
  console.error('Failed to generate card:', error);
  process.exitCode = 1;
});
