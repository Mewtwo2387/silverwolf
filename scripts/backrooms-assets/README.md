# Backrooms art assets

How everything under `site_src/Assets/backrooms/` was made. **You do not need to
run any of this to build or run the site** — the outputs are committed. This
exists so the assets can be regenerated, re-tuned or re-sourced without
reverse-engineering them.

Everything here is CC0. Nothing is redistributed under a licence that requires
permission, and the game's credits panel (the Art assets group in
`site_src/pages/games/backrooms.ts`) names every source anyway.

## Surfaces — `bake-surfaces.py`

```
pip install pillow
python3 scripts/backrooms-assets/bake-surfaces.py
```

Downloads eleven CC0 material sets from [ambientCG](https://ambientcg.com/) and
bakes them to `<slug>_{col,nrm,rgh}.webp` (~2.9 MB total; Level 0 accounts for
2.7 MB of it, the Poolrooms for 125 KB). Ambient occlusion is multiplied into
the albedo rather than shipped as an `aoMap`, because three.js reads `aoMap`
from a second UV set and the level's geometry builders emit one.

The scans are near-white. The mono-yellow comes from the per-variant `color`
tints in `upgradeSurfaces()` (`backrooms-materials.js`), which are the
linear-space ratio between each scan's *measured* mean and the palette entry the
procedural texture used. **Swap an asset and those tints must be recomputed**,
or the level drifts off-palette.

## Player — `fetch-quaternius.sh` → `uvpos.py` → `clothe.py` → `build-player.ts`

The body and its animations come from two CC0 [Quaternius](https://quaternius.com)
packs that happen to share a byte-identical 65-bone Unreal-standard rig, so the
clips drive the body with no retargeting at all.

```
./fetch-quaternius.sh universal-base-characters   ubc.zip   # body
./fetch-quaternius.sh universal-animation-library ual1.zip  # clips
unzip ...                                                   # see the scripts' paths
pip install numpy pillow
python3 uvpos.py     # bake a UV -> 3D-position map off the body mesh
python3 clothe.py    # cut jeans/hoodie/boots from that map
bun build-player.ts  # merge mesh + 12 clips -> player.glb
```

**The clothes.** The free tier of Universal Base Characters ships the body
undressed, so the garments are ours. They are not painted onto the atlas by
hand: `uvpos.py` rasterises every UV triangle and records the rest-pose 3D
position behind each texel, which turns "the hem sits at the hip" into a plane
test instead of a brush stroke. `clothe.py` then cuts jeans, hoodie and boots
from those positions, adds a waistband and cuffs where the garments meet, and
— importantly — flattens the scanned skin normal map under cloth, so the
anatomy underneath stops printing through the trousers.

Landmark heights (ankle, knee, hip, waist, neck) and the arm/wrist thresholds
are constants at the top of `clothe.py`; they are the only things worth tuning.

**Known limitation.** The garments have no silhouette of their own — they are
cut on the nude body geometry, so the figure reads as closely-fitted clothing
rather than a loose hoodie. Fixing that properly needs actual garment meshes.

**Two source files in the pack are broken**: `Superhero_Male_FullBody.gltf`
references `T_Hair_1_Normal_png.png` and `T_Eye_Normal_png.png`, neither of
which is in the archive. Copy `T_Hair_1_Normal.png` / `T_Eye_Normal.png` to
those names before running `build-player.ts` or the glTF fails to load.

`build-player.ts` keeps only the twelve clips the player controller can actually
reach (idle, walk, jog, sprint, crouch idle/walk, swim, tread, the three-part
jump, death) and prunes unused vertex attributes; the result is ~1.5 MB, of
which only ~210 KB is texture — the rest is keyframe data.
