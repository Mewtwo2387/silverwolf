import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve(import.meta.dir, '..', 'site_src', 'Assets', 'planes');

// Helper to save a canvas to file
function saveCanvas(canvas: any, destPath: string) {
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
  fs.writeFileSync(destPath, buffer);
  console.log(`Saved: ${destPath}`);
}

// Draw a beautiful camouflage pattern
function drawCamoPattern(width: number, height: number, baseColor: string, color2: string, color3?: string) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Draw random blobs for color2
  ctx.fillStyle = color2;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = width * (0.08 + Math.random() * 0.15);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw random blobs for color3
  if (color3) {
    ctx.fillStyle = color3;
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = width * (0.05 + Math.random() * 0.10);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}

// Blend a texture sheet with a camouflage canvas using luminosity preservation
async function blendCamo(
  filename: string,
  suffix: string,
  baseColor: string,
  color2: string,
  color3?: string
) {
  const srcPath = path.join(ASSETS_DIR, `${filename}.jpg`);
  const destPath = path.join(ASSETS_DIR, `${filename}-${suffix}.jpg`);

  const img = await loadImage(srcPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Generate camo pattern of same size
  const camo = drawCamoPattern(img.width, img.height, baseColor, color2, color3);
  const camoCtx = camo.getContext('2d');
  const camoData = camoCtx.getImageData(0, 0, camo.width, camo.height).data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Detect roundels/insignia (red, blue, yellow)
    const isRed = r > 85 && r > g * 1.3 && r > b * 1.3;
    const isBlue = b > 85 && b > r * 1.25 && b > g * 1.1;
    const isYellow = r > 110 && g > 110 && b < 95;

    if (isRed || isBlue || isYellow) {
      continue; // preserve original insignia colors
    }

    const cr = camoData[i];
    const cg = camoData[i + 1];
    const cb = camoData[i + 2];

    // Calculate luminosity (original shading)
    const gray = (r + g + b) / 3;
    
    // Apply shading: multiply camo color by relative lightness
    const nr = Math.min(255, Math.round(cr * (gray / 165)));
    const ng = Math.min(255, Math.round(cg * (gray / 165)));
    const nb = Math.min(255, Math.round(cb * (gray / 165)));

    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, destPath);
}

// Special handling for P-51 Red Tails:
// Fuse tail/rudder coordinates get bright red, fuselage gets metallic silver.
async function blendP51Special() {
  const img = await loadImage(path.join(ASSETS_DIR, 'p51-fus.jpg'));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Detect insignia
    const isRed = r > 85 && r > g * 1.3 && r > b * 1.3;
    const isBlue = b > 85 && b > r * 1.25 && b > g * 1.1;
    const isYellow = r > 110 && g > 110 && b < 95;
    if (isRed || isBlue || isYellow) continue;

    const gray = (r + g + b) / 3;
    // Silver metal: desaturate and brighten
    const val = Math.min(255, Math.round(gray * 1.18 + 10));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, path.join(ASSETS_DIR, 'p51-fus-special.jpg'));
}

async function blendP51TailSpecial() {
  // Red Tail Section
  const img = await loadImage(path.join(ASSETS_DIR, 'p51-tai.jpg'));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Detect insignia
    const isRed = r > 85 && r > g * 1.3 && r > b * 1.3;
    const isBlue = b > 85 && b > r * 1.25 && b > g * 1.1;
    const isYellow = r > 110 && g > 110 && b < 95;
    if (isRed || isBlue || isYellow) continue;

    const gray = (r + g + b) / 3;
    // Tail is solid red: blend gray with red
    const nr = Math.min(255, Math.round(210 * (gray / 170)));
    const ng = Math.min(255, Math.round(25 * (gray / 170)));
    const nb = Math.min(255, Math.round(25 * (gray / 170)));

    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, path.join(ASSETS_DIR, 'p51-tai-special.jpg'));
}

async function blendP51RudderSpecial() {
  // Rudder Section: Solid red
  const img = await loadImage(path.join(ASSETS_DIR, 'p51-rud.jpg'));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray = (r + g + b) / 3;
    const nr = Math.min(255, Math.round(220 * (gray / 170)));
    const ng = Math.min(255, Math.round(20 * (gray / 170)));
    const nb = Math.min(255, Math.round(20 * (gray / 170)));

    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, path.join(ASSETS_DIR, 'p51-rud-special.jpg'));
}

// Blend simple metallic silver for planes/bomber
async function blendSilver(filename: string, suffix: string) {
  const srcPath = path.join(ASSETS_DIR, `${filename}.jpg`);
  const destPath = path.join(ASSETS_DIR, `${filename}-${suffix}.jpg`);

  const img = await loadImage(srcPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isRed = r > 85 && r > g * 1.3 && r > b * 1.3;
    const isBlue = b > 85 && b > r * 1.25 && b > g * 1.1;
    const isYellow = r > 110 && g > 110 && b < 95;

    if (isRed || isBlue || isYellow) continue;

    const gray = (r + g + b) / 3;
    // Bright silver metallic
    const val = Math.min(255, Math.round(gray * 1.2 + 10));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  saveCanvas(canvas, destPath);
}

async function main() {
  console.log('Generating realistic procedural liveries...');

  // --- Spitfire Skins (also generate these in case we want a procedurally consistent look) ---
  // Spitfire Desert (Tan / sand yellow + brown)
  await blendCamo('spit-skin', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');
  // Spitfire Winter (White + light gray + medium gray)
  await blendCamo('spit-skin', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');
  // Spitfire Special: since we already have the D-Day stripes from image generator, let's keep it!

  // --- A6M Zero ---
  // Zero Desert
  await blendCamo('zero-sheet', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');
  // Zero Winter
  await blendCamo('zero-sheet', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');
  // Zero Special (Late-war Dark Green)
  await blendCamo('zero-sheet', 'special', 'rgb(40, 68, 45)', 'rgb(28, 45, 30)');

  // --- P-51 Mustang ---
  // P-51 Desert
  await blendCamo('p51-fus', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');
  await blendCamo('p51-tai', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');
  await blendCamo('p51-wng', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');

  // P-51 Winter
  await blendCamo('p51-fus', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');
  await blendCamo('p51-tai', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');
  await blendCamo('p51-wng', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');

  // P-51 Special (Red Tails)
  await blendP51Special();
  await blendP51TailSpecial();
  await blendP51RudderSpecial();
  await blendSilver('p51-wng', 'special');

  // --- Carpet Bomber ---
  // Bomber Desert
  await blendCamo('bomber-hull', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');
  await blendCamo('bomber-wing', 'desert', 'rgb(215, 190, 140)', 'rgb(125, 85, 45)', 'rgb(95, 100, 75)');

  // Bomber Winter
  await blendCamo('bomber-hull', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');
  await blendCamo('bomber-wing', 'winter', 'rgb(235, 235, 235)', 'rgb(175, 180, 185)', 'rgb(135, 140, 145)');

  // Bomber Special (Silver Metal)
  await blendSilver('bomber-hull', 'special');
  await blendSilver('bomber-wing', 'special');

  console.log('Procedural skin generation completed!');
}

main().catch((err) => {
  console.error('Failed to generate procedural skins:', err);
});
