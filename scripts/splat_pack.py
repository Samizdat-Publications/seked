"""
A trained Gaussian splat (.ply, as Brush exports it) packed for the web as a `.splat`: 32 bytes a splat (position and
scale as float32, colour and opacity as bytes, rotation as bytes), the layout three.js splat viewers read. Only the base
colour is kept (the view-dependent terms are most of the file), nearly transparent splats are dropped, and so is
anything farther from the area's centre than --radius.

    python scripts/splat_pack.py build/splat/sphinx-today/out3/sphinx-30000.ply build/splat/sphinx-today/sphinx.splat --centre 322,-433,-30 --radius 160

Numpy only.
"""
import argparse
import os

import numpy as np

SH_C0 = 0.28209479177387814


def read_ply(path):
    with open(path, "rb") as f:
        names, n = [], 0
        while True:
            line = f.readline().decode("ascii").strip()
            if line.startswith("element vertex"):
                n = int(line.split()[-1])
            elif line.startswith("property"):
                kind, name = line.split()[1], line.split()[2]
                if kind != "float":
                    raise SystemExit(f"{path}: property {name} is {kind}; only float splats are read")
                names.append(name)
            elif line == "end_header":
                break
        data = np.fromfile(f, dtype=np.float32, count=n * len(names)).reshape(n, len(names))
    return {k: data[:, i] for i, k in enumerate(names)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--centre", default="0,0,0")
    ap.add_argument("--radius", type=float, default=1e9)
    ap.add_argument("--min-opacity", type=float, default=0.04)
    ap.add_argument("--max-mb", type=float, default=0.0, help="keep only the most visible splats that fit (0: no cap)")
    a = ap.parse_args()
    p = read_ply(a.src)
    xyz = np.stack([p["x"], p["y"], p["z"]], 1)
    opacity = 1 / (1 + np.exp(-p["opacity"]))
    c = np.array([float(v) for v in a.centre.split(",")], np.float32)
    keep = (opacity >= a.min_opacity) & (np.linalg.norm(xyz - c, axis=1) <= a.radius)
    scale = np.exp(np.stack([p["scale_0"], p["scale_1"], p["scale_2"]], 1))
    rgb = np.clip(0.5 + SH_C0 * np.stack([p["f_dc_0"], p["f_dc_1"], p["f_dc_2"]], 1), 0, 1)
    rot = np.stack([p["rot_0"], p["rot_1"], p["rot_2"], p["rot_3"]], 1)
    rot /= np.linalg.norm(rot, axis=1, keepdims=True)
    # the most visible first, so a viewer that streams shows the shape early
    order = np.argsort(-(scale.prod(1) ** (1 / 3) * opacity)[keep])
    idx = np.nonzero(keep)[0][order]
    if a.max_mb:
        idx = idx[: int(a.max_mb * 1e6 // 32)]
    n = len(idx)
    rec = np.zeros(n, dtype=[("pos", "<f4", 3), ("scale", "<f4", 3), ("rgba", "u1", 4), ("rot", "u1", 4)])
    rec["pos"] = xyz[idx]
    rec["scale"] = scale[idx]
    rec["rgba"][:, :3] = (rgb[idx] * 255).round()
    rec["rgba"][:, 3] = (opacity[idx] * 255).round()
    rec["rot"] = np.clip(rot[idx] * 128 + 128, 0, 255).round()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    rec.tofile(a.out)
    print(f"{len(xyz)} splats read, {n} kept ({n / len(xyz):.0%}), {os.path.getsize(a.out) / 1e6:.1f} MB to {a.out}")


if __name__ == "__main__":
    main()
