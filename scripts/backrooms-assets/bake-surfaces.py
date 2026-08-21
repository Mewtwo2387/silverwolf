"""Fetch and bake the Backrooms' scanned surface maps from ambientCG (CC0).

Output lands in site_src/Assets/backrooms/ as <slug>_{col,nrm,rgh}.webp, which
is what backrooms-textures.js loads and routes/static.ts serves.

Two decisions are baked in here rather than left to runtime:

  * Ambient occlusion is multiplied into the albedo. three.js reads aoMap from
    a second UV set and every geometry builder in this level emits exactly one;
    on flat wall/floor/ceiling quads the baked result is indistinguishable and
    it saves a texture fetch per surface.
  * Resolution and quality are per-surface. Wallpaper is the thing you end up
    with your face against in a corridor, so it stays at 1K for both albedo and
    normal. Carpet and ceiling fibre is high-frequency noise that compresses
    badly and is never seen closer than about 1.5 m, so their normals drop to
    512 — that alone is most of the difference between a 5 MB set and a 3 MB one.

Usage:  python3 scripts/backrooms-assets/bake-surfaces.py [workdir]
Needs:  pillow  (pip install pillow)
"""
import glob
import os
import sys
import urllib.request
import zipfile

from PIL import Image, ImageChops, ImageStat

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "site_src", "Assets", "backrooms")
WORK = sys.argv[1] if len(sys.argv) > 1 else ".acg-cache"

# slug -> (ambientCG asset, albedo px, albedo quality, normal px, normal q, rough px)
SETS = {
    "wall-a": ("Wallpaper001A", 1024, 82, 1024, 88, 512),
    "wall-b": ("Wallpaper001C", 1024, 82, 1024, 88, 512),
    "wall-c": ("Wallpaper002B", 1024, 82, 1024, 88, 512),
    "wall-d": ("Wallpaper002C", 1024, 80, 1024, 86, 512),
    "carpet-a": ("Carpet016", 1024, 74, 512, 84, 256),
    "carpet-b": ("Carpet011", 1024, 72, 512, 82, 256),
    "carpet-c": ("Carpet008", 1024, 74, 512, 82, 256),
    "ceiling-a": ("OfficeCeiling001", 1024, 80, 512, 86, 512),
    "ceiling-b": ("OfficeCeiling006", 1024, 80, 512, 86, 512),
    "pooltile-a": ("Tiles036", 1024, 86, 1024, 90, 512),
    "pooltile-b": ("Tiles107", 1024, 86, 1024, 90, 512),
}

# The Poolrooms read as impossibly clean, which the raw scans are not: Tiles036
# is a correct mid-grey ceramic under a studio light. Lift them at bake time so
# the material can stay untinted — MeshStandardMaterial.color cannot exceed 1,
# so a texture that is too dark cannot be rescued at runtime.
BRIGHTEN = {"pooltile-a": 236.0, "pooltile-b": 240.0}


def fetch(asset):
    os.makedirs(WORK, exist_ok=True)
    zip_path = os.path.join(WORK, f"{asset}.zip")
    if not os.path.exists(zip_path) or os.path.getsize(zip_path) == 0:
        url = f"https://ambientcg.com/get?file={asset}_1K-JPG.zip"
        print(f"  fetching {asset} ...")
        urllib.request.urlretrieve(url, zip_path)
    out_dir = os.path.join(WORK, asset)
    if not os.path.isdir(out_dir):
        with zipfile.ZipFile(zip_path) as z:
            for name in z.namelist():
                if name.endswith(("_Color.jpg", "_NormalGL.jpg", "_Roughness.jpg",
                                  "_AmbientOcclusion.jpg")):
                    z.extract(name, out_dir)
    return out_dir


def find(directory, suffix):
    hits = glob.glob(os.path.join(directory, "**", f"*_{suffix}.jpg"), recursive=True)
    return hits[0] if hits else None


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for slug, (asset, cs, cq, ns, nq, rs) in SETS.items():
        d = fetch(asset)

        col = Image.open(find(d, "Color")).convert("RGB")
        ao_path = find(d, "AmbientOcclusion")
        if ao_path:
            ao = Image.open(ao_path).convert("L").resize(col.size)
            # Softened, so it darkens crevices without crushing the whole sheet.
            ao = ao.point(lambda v: int(255 * (0.35 + 0.65 * (v / 255))))
            col = ImageChops.multiply(col, Image.merge("RGB", (ao, ao, ao)))
        if slug in BRIGHTEN:
            mean = sum(ImageStat.Stat(col).mean) / 3
            k = BRIGHTEN[slug] / mean
            col = col.point(lambda v, k=k: min(255, int(v * k)))
        col.resize((cs, cs), Image.LANCZOS).save(
            f"{OUT}/{slug}_col.webp", "WEBP", quality=cq, method=6)

        Image.open(find(d, "NormalGL")).convert("RGB").resize((ns, ns), Image.LANCZOS).save(
            f"{OUT}/{slug}_nrm.webp", "WEBP", quality=nq, method=6)
        Image.open(find(d, "Roughness")).convert("L").resize((rs, rs), Image.LANCZOS).save(
            f"{OUT}/{slug}_rgh.webp", "WEBP", quality=78, method=6)

        size = sum(os.path.getsize(f"{OUT}/{slug}_{k}.webp") for k in ("col", "nrm", "rgh"))
        total += size
        print(f"{slug:12s} {asset:18s} {size / 1024:7.0f} KB")
    print(f"{'TOTAL':12s} {'':18s} {total / 1024:7.0f} KB")
    print("\nTints in upgradeSurfaces() are derived from these images' measured")
    print("means — if you swap an asset, recompute them or the palette will drift.")


if __name__ == "__main__":
    main()
