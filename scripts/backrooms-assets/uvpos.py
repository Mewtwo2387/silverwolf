"""Bake a UV->3D-position map for the Quaternius base body.

Painting clothes onto an unlabelled 2K atlas by eye is guesswork. Instead:
rasterise every UV triangle of the body mesh and store, per texel, the 3D
rest-pose position it comes from. A garment boundary then becomes a rule about
*space* ("below the hip", "above the wrist"), which is exact, and the messy UV
seams fall out for free.

Emits uvpos.npy: (H, W, 4) float32 = x, y, z, coverage.
"""
import json, struct, base64, os
import numpy as np

BASE = "ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE"
GLTF = f"{BASE}/Superhero_Male_FullBody.gltf"
SIZE = 2048
BODY_MESH = "Sphere.005_Retopology.004"

d = json.load(open(GLTF))
bins = {}


def buffer_bytes(i):
    if i in bins:
        return bins[i]
    uri = d["buffers"][i]["uri"]
    if uri.startswith("data:"):
        raw = base64.b64decode(uri.split(",", 1)[1])
    else:
        from urllib.parse import unquote
        raw = open(os.path.join(BASE, unquote(uri)), "rb").read()
    bins[i] = raw
    return raw


COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2),
        5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def accessor(idx):
    a = d["accessors"][idx]
    bv = d["bufferViews"][a["bufferView"]]
    raw = buffer_bytes(bv.get("buffer", 0))
    fmt, sz = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or sz * n
    out = np.empty((a["count"], n), dtype=np.float64)
    for k in range(a["count"]):
        off = start + k * stride
        out[k] = struct.unpack_from("<" + fmt * n, raw, off)
    return out


mesh = next(m for m in d["meshes"] if m["name"] == BODY_MESH)
prim = mesh["primitives"][0]
pos = accessor(prim["attributes"]["POSITION"])
uv = accessor(prim["attributes"]["TEXCOORD_0"])
idx = accessor(prim["indices"])[:, 0].astype(np.int64)
print(f"body: {len(pos)} verts, {len(idx)//3} tris")
print(f"bbox y: {pos[:,1].min():.3f} .. {pos[:,1].max():.3f}")

out = np.zeros((SIZE, SIZE, 4), dtype=np.float32)

# Standard barycentric rasteriser, per triangle, in texel space. The atlas is
# small enough that a straightforward loop is fine (~12k triangles).
for t in range(len(idx) // 3):
    tri = idx[t * 3:t * 3 + 3]
    p = pos[tri]
    # glTF UV origin is top-left; image rows run the same way.
    u = uv[tri, 0] * (SIZE - 1)
    v = uv[tri, 1] * (SIZE - 1)
    x0, x1 = int(np.floor(u.min())), int(np.ceil(u.max()))
    y0, y1 = int(np.floor(v.min())), int(np.ceil(v.max()))
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, SIZE - 1), min(y1, SIZE - 1)
    if x1 < x0 or y1 < y0:
        continue
    ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    px, py = xs + 0.5, ys + 0.5
    d00u, d00v = u[1] - u[0], v[1] - v[0]
    d01u, d01v = u[2] - u[0], v[2] - v[0]
    den = d00u * d01v - d01u * d00v
    if abs(den) < 1e-12:
        continue
    wx, wy = px - u[0], py - v[0]
    b1 = (wx * d01v - d01u * wy) / den
    b2 = (d00u * wy - wx * d00v) / den
    b0 = 1.0 - b1 - b2
    # Half-texel slack closes the hairline gaps between adjacent UV triangles.
    m = (b0 >= -0.002) & (b1 >= -0.002) & (b2 >= -0.002)
    if not m.any():
        continue
    world = (b0[..., None] * p[0] + b1[..., None] * p[1] + b2[..., None] * p[2])
    sub = out[y0:y1 + 1, x0:x1 + 1]
    sub[m, 0:3] = world[m]
    sub[m, 3] = 1.0

print(f"coverage: {out[...,3].mean()*100:.1f}% of atlas")
np.save("uvpos.npy", out)
