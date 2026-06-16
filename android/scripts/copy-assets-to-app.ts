import { mkdir, copyFile, readdir } from "fs/promises";
import { join } from "path";

const SRC_ASSETS = "./site_src/Assets";
const DEST_OFFLINE = "./android/app/src/main/assets/offline";

async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  console.log("🚀 Copying frontend assets to Android app assets...");

  try {
    // 1. Copy styles.css
    await mkdir(DEST_OFFLINE, { recursive: true });
    await copyFile(join(SRC_ASSETS, "styles.css"), join(DEST_OFFLINE, "styles.css"));
    console.log("✅ Copied styles.css");

    // 2. Copy fonts
    await copyDir(join(SRC_ASSETS, "fonts"), join(DEST_OFFLINE, "fonts"));
    console.log("✅ Copied fonts");

    // 3. Copy svg
    await copyDir(join(SRC_ASSETS, "svg"), join(DEST_OFFLINE, "svg"));
    console.log("✅ Copied svg");

    // 4. Copy Images
    await copyDir(join(SRC_ASSETS, "Images"), join(DEST_OFFLINE, "Images"));
    console.log("✅ Copied Images");

    console.log("🎉 Frontend assets successfully bundled into Android app!");
  } catch (error) {
    console.error("❌ Failed to copy assets:", error);
    process.exit(1);
  }
}

main();
