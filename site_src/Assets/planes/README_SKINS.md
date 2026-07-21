# Plane Sim Aircraft Liveries (Skins) Reference

This directory contains the original and custom aircraft texture sheets and preview thumbnails for the Plane Sim game and Model Inspector.

Due to initial AI image generation rate limits, some skins were generated via our advanced canvas blending script (which blends procedural camouflage patterns/metallics with the original texture sheet's panel line and rivet shading).

---

## 1. Current Skin Status

| Aircraft | Original Texture | Desert Theme | Winter Theme | Special Theme | Status / Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spitfire** | `spit-skin.jpg` | `spit-skin-desert.jpg` | `spit-skin-winter.jpg` | `spit-skin-special.jpg` | **AI Generated** (Gemini Image Model) |
| **Zero** | `zero-sheet.jpg` | `zero-sheet-desert.jpg` | `zero-sheet-winter.jpg` | `zero-sheet-special.jpg` | **Desert:** AI Generated<br>**Winter & Special:** Procedural |
| **P-51 Mustang** | `p51-fus.jpg`<br>`p51-tai.jpg`<br>`p51-rud.jpg`<br>`p51-elv.jpg`<br>`p51-wng.jpg` | Append `-desert` | Append `-winter` | Append `-special` | **Procedural** (Fuselage/wings metallic silver; Special tail/rudder painted Tuskegee Red) |
| **Carpet Bomber**| `bomber-hull.jpg`<br>`bomber-wing.jpg`<br>`bomber-det.jpg` | Append `-desert` | Append `-winter` | Append `-special` | **Procedural** (Hull/wings shaded to desert sand, winter white, and silver metallic) |

---

## 2. Generating & Replacing Skins Manually

When your Gemini Image Generator quota resets, you can replace the procedural skins with high-fidelity AI-generated texture sheets.

### Instructions:
1. Use the **original texture sheet** (e.g. `zero-sheet.jpg` or `p51-fus.jpg`) as the **reference image** in the generator.
2. Run the corresponding prompt below.
3. Save the output directly into `site_src/Assets/planes/` with the target suffix name (e.g. `zero-sheet-winter.jpg`).
4. Run `bun run build:js` to rebuild the assets.

### Generation Prompts:

#### A6M Zero
- **Winter Theme (`zero-sheet-winter.jpg`):**
  > "Repaint this aircraft 2D texture map sheet with a winter snow white and light-grey camouflage pattern. Keep the exact UV layout, panel lines, rivets, weathering, and Japanese Hinomaru roundel positions identical. Do not modify the structure or positions of the parts on the sheet."
- **Special Theme - Late-War Green (`zero-sheet-special.jpg`):**
  > "Repaint this aircraft 2D texture map sheet with a late-war IJN dark green camouflage pattern. Keep the exact UV layout, panel lines, rivets, weathering, and Japanese Hinomaru roundel positions identical. Do not modify the structure or positions of the parts on the sheet."

#### P-51 Mustang
- **Desert Theme (`p51-fus-desert.jpg` & `p51-tai-desert.jpg`):**
  > "Repaint this aircraft fuselage 2D texture map sheet with a desert sand-yellow and brown camouflage pattern. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."
- **Winter Theme (`p51-fus-winter.jpg` & `p51-tai-winter.jpg`):**
  > "Repaint this aircraft fuselage 2D texture map sheet with a winter snow white and grey camouflage pattern. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."
- **Special Theme - Red Tails (`p51-fus-special.jpg` & `p51-tai-special.jpg`):**
  > "Repaint this aircraft fuselage 2D texture map sheet with a polished silver-metallic finish. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."

#### Carpet Bomber
- **Desert Theme (`bomber-hull-desert.jpg` & `bomber-wing-desert.jpg`):**
  > "Repaint this bomber 2D texture map sheet with an olive-drab and desert sand camouflage pattern. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."
- **Winter Theme (`bomber-hull-winter.jpg` & `bomber-wing-winter.jpg`):**
  > "Repaint this bomber 2D texture map sheet with a winter white and grey camouflage pattern. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."
- **Special Theme - Silver Metal (`bomber-hull-special.jpg` & `bomber-wing-special.jpg`):**
  > "Repaint this bomber 2D texture map sheet with a polished silver-metallic aluminum finish. Keep the exact UV layout, panel lines, rivets, and weathering identical. Do not modify the structure or positions of the parts on the sheet."

---

## 3. Re-running the Procedural Script

If you make modifications to the baseline textures or want to reset the procedurally generated skins, you can re-run the script:
```bash
bun run scripts/generate-skins-procedural.ts
bun run scripts/generate-previews-procedural.ts
```
