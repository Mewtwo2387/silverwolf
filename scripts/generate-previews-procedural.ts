import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve(import.meta.dir, '..', 'site_src', 'Assets', 'planes');

// Helper to save a canvas to file
function saveCanvas(canvas: any, destPath: string) {
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(destPath, buffer);
  console.log(`Saved preview: ${destPath}`);
}

// `--force` overwrites previews that already exist. Without it we skip them:
// several shipped previews (the P-51 original/desert/winter set) are
// higher-fidelity AI-generated art, and a plain re-run would silently replace
// them with procedural crops. See README_SKINS.md §4.
const FORCE = process.argv.includes('--force');

async function createCropPreview(srcName: string, destName: string, cropX: number, cropY: number, size: number) {
  const srcPath = path.join(ASSETS_DIR, `${srcName}.jpg`);
  const destPath = path.join(ASSETS_DIR, `${destName}.jpg`);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source texture not found for preview: ${srcPath}`);
    return;
  }

  if (!FORCE && fs.existsSync(destPath)) {
    console.log(`Skipping existing preview (pass --force to overwrite): ${destPath}`);
    return;
  }

  const img = await loadImage(srcPath);
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');

  // Draw cropped section of original texture sheet to give realistic preview
  const cx = Math.min(img.width - size, Math.max(0, cropX));
  const cy = Math.min(img.height - size, Math.max(0, cropY));
  ctx.drawImage(img, cx, cy, size, size, 0, 0, 256, 256);

  saveCanvas(canvas, destPath);
}

async function main() {
  console.log('Generating aircraft livery previews...');

  // --- P-51 Previews ---
  await createCropPreview('p51-fus', 'p51-original-preview', 120, 120, 200);
  await createCropPreview('p51-fus-desert', 'p51-desert-preview', 120, 120, 200);
  await createCropPreview('p51-fus-winter', 'p51-winter-preview', 120, 120, 200);
  await createCropPreview('p51-fus-special', 'p51-special-preview', 120, 120, 200);

  // --- Bomber Previews ---
  await createCropPreview('bomber-hull', 'bomber-original-preview', 150, 150, 200);
  await createCropPreview('bomber-hull-desert', 'bomber-desert-preview', 150, 150, 200);
  await createCropPreview('bomber-hull-winter', 'bomber-winter-preview', 150, 150, 200);
  await createCropPreview('bomber-hull-special', 'bomber-special-preview', 150, 150, 200);

  console.log('Livery previews generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate previews:', err);
});
