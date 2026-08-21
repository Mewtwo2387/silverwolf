"""Dress the Quaternius base body by cutting garments in 3D, not in UV.

uvpos.npy gives each texel its rest-pose position, so "the hem sits at the
hip" is a plane test rather than a brush stroke. Three maps come out:

  body_col  albedo   — jeans, hoodie, boots painted over the CC0 skin atlas
  body_rgh  roughness — fabric is much rougher than skin
  body_nrm  normal    — the source normal map carries abs and knee definition
                        that would print straight through a garment, so it is
                        flattened under cloth and given a faint weave instead.

The figure is lit by fluorescent tubes in a yellow corridor, so the palette is
deliberately cold and drab: it separates from the wallpaper without ever
looking like a costume.
"""
import numpy as np
from PIL import Image

BASE = "ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE"
SIZE = 2048

uvp = np.load("uvpos.npy")
X, Y, Z, COV = uvp[..., 0], uvp[..., 1], uvp[..., 2], uvp[..., 3]

# Landmarks on the 1.81 m rest pose (metres from the floor).
ANKLE, KNEE, HIP, WAIST, CHEST, NECK = 0.11, 0.48, 0.86, 1.06, 1.30, 1.545
# The pose is a T/A-pose spread to x = +-0.93, so an arm is anything far from
# the midline; the hand starts near the far end of that reach.
ARM_IN, WRIST = 0.19, 0.70

rng = np.random.default_rng(7)


def smooth(v, edge, width):
    """0 below edge-width, 1 above edge — a soft hem instead of a jagged one."""
    return np.clip((v - (edge - width)) / width, 0, 1)


is_arm = np.abs(X) > ARM_IN
is_hand = np.abs(X) > WRIST

# --- garment masks -------------------------------------------------------
boots = (Y < ANKLE + 0.06) & ~is_arm
jeans = smooth(Y, ANKLE + 0.04, 0.03) * (1 - smooth(Y, WAIST, 0.02)) * (~is_arm)
# The hoodie covers the torso from just under the waistband up to the neck, and
# runs out along both arms to the wrist. Sleeve and body are one mask so the
# shoulder seam lands where the geometry actually turns.
torso = smooth(Y, WAIST - 0.10, 0.04) * (1 - smooth(Y, NECK, 0.02)) * (~is_arm)
sleeve = (is_arm & ~is_hand).astype(float) * (1 - smooth(np.abs(X), WRIST, 0.03))
hoodie = np.clip(torso + sleeve, 0, 1)
jeans = np.clip(jeans - hoodie, 0, 1)
cloth = np.clip(hoodie + jeans + boots.astype(float), 0, 1) * COV

# --- albedo --------------------------------------------------------------
col = np.asarray(Image.open(f"{BASE}/T_Superhero_Male_Dark.png").convert("RGB"), dtype=np.float32)

# Values matter more than hues here. Level 0 is dim and monochrome-yellow, and
# the first pass used ~60/255 for both garments: under that light the top and
# the trousers collapsed to the same near-black shape and the figure read as
# unclothed. These are lifted well clear of black and, more importantly, split
# across value (pale top, mid trousers, dark boots) so the waistline is legible
# even when the colour is being crushed by a sodium-yellow key light.
JEANS = np.array([88, 98, 124], np.float32)
HOODIE = np.array([166, 168, 158], np.float32)
BOOTS = np.array([44, 42, 46], np.float32)

# Cheap fabric grain: fine noise for weave, broad noise for wear and fading.
fine = rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32)
fine = (fine - fine.min()) / (fine.max() - fine.min())
broad = np.asarray(Image.fromarray((rng.random((64, 64)) * 255).astype(np.uint8))
                   .resize((SIZE, SIZE), Image.BICUBIC), np.float32) / 255.0

grain = (0.90 + 0.16 * broad + 0.05 * fine)[..., None]
# Denim fades over the thighs and seat the way real trousers do.
fade = (1 + 0.13 * np.clip((Y - KNEE) / (HIP - KNEE), 0, 1))[..., None]

out = col.copy()
for mask, rgb, extra in ((jeans, JEANS, fade), (hoodie, HOODIE, 1.0), (boots.astype(float), BOOTS, 1.0)):
    m = (mask * COV)[..., None]
    out = out * (1 - m) + (rgb * grain * extra) * m
out = np.clip(out, 0, 255)

# Waistband and cuffs: a thin darker band reads as a seam and stops the two
# garments dissolving into each other where they meet.
for band, width in ((WAIST, 0.026), (ANKLE + 0.05, 0.018), (NECK, 0.016)):
    b = (np.abs(Y - band) < width) & (cloth > 0.5)
    out[b] *= 0.58
# Sleeve cuffs run along x, not y.
cuff = (np.abs(np.abs(X) - WRIST) < 0.018) & (cloth > 0.5)
out[cuff] *= 0.58

Image.fromarray(out.astype(np.uint8)).save("body_col.png")

# --- roughness -----------------------------------------------------------
rgh = np.asarray(Image.open(f"{BASE}/T_Superhero_Male_Roughness.png").convert("L"), np.float32)
fabric = np.where(boots, 130.0, 224.0)  # leather is glossier than cotton
m = cloth
rgh = rgh * (1 - m) + fabric * m
Image.fromarray(np.clip(rgh, 0, 255).astype(np.uint8)).save("body_rgh.png")

# --- normal --------------------------------------------------------------
nrm = np.asarray(Image.open(f"{BASE}/T_Superhero_Male_Normal.png").convert("RGB"), np.float32)
flat = np.array([128, 128, 255], np.float32)
weave = ((fine - 0.5) * 14)[..., None] * np.array([1, 1, 0], np.float32)
m = (cloth * 0.88)[..., None]
nrm = nrm * (1 - m) + (flat + weave) * m
Image.fromarray(np.clip(nrm, 0, 255).astype(np.uint8)).save("body_nrm.png")

pct = lambda a: f"{(a * COV).sum() / COV.sum() * 100:.1f}%"
print(f"jeans {pct(jeans)}  hoodie {pct(hoodie)}  boots {pct(boots.astype(float))}  "
      f"skin {pct(1 - cloth)}")
