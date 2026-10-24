"""
The voxel half of scripts/sphinx_lab/descaffold.py, run by it in the system Python (scipy, scikit-image):

    python scripts/sphinx_lab/descaffold_voxels.py IN.npz OUT.npz PARAMS.json

IN holds the welded shell in metres (`verts`, `tris`) and the textured original's face centres in metres
(`centres`). sphinx-meshy is a hollow shell a few centimetres thick, so an opening of the mesh itself eats the
whole statue; here the shell is voxelized, filled into a solid, and opened, and OUT says which of the original's
faces lie off the opened solid (`thin`, per face) and carries the opened solid's surface near them (`pverts`,
`ptris`, in metres) for the stand-in.
"""
import json
import sys

import numpy as np
from scipy import ndimage
from skimage import measure


def ball(r):
    n = int(np.ceil(r))
    z, y, x = np.mgrid[-n:n + 1, -n:n + 1, -n:n + 1]
    return x * x + y * y + z * z <= r * r


def main(src, dst, params):
    P = json.load(open(params, encoding="utf-8"))
    d = np.load(src)
    V, T, C = d["verts"], d["tris"], d["centres"]
    h = P["grid"]
    pad = P["open"] * 2 + 4 * h
    lo = V.min(0) - pad
    shape = np.ceil((V.max(0) + pad - lo) / h).astype(int) + 1
    print("grid", shape.tolist(), flush=True)
    # the shell on the grid: points spread over every triangle closer than the voxel, so it has no gaps
    surf = np.zeros(shape, bool)
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    span = np.max([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1), np.linalg.norm(a - c, axis=1)], 0)
    for n in sorted(set(np.ceil(span / (0.5 * h)).astype(int).clip(1, 40))):
        sel = np.ceil(span / (0.5 * h)).astype(int).clip(1, 40) == n
        u, w = np.mgrid[0:n + 1, 0:n + 1].reshape(2, -1) / n
        keep = u + w <= 1
        u, w = u[keep], w[keep]
        pts = (a[sel, None] * (1 - u - w)[None, :, None] + b[sel, None] * u[None, :, None]
               + c[sel, None] * w[None, :, None]).reshape(-1, 3)
        idx = np.floor((pts - lo) / h).astype(int)
        surf[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    surf = ndimage.binary_dilation(surf, ball(1))
    print("shell on the grid", flush=True)
    # inside: shell on both sides along at least two of the three axes. A fill of the enclosed space leaks out
    # through the doorway in the north flank, which opens into the hollow
    votes = np.zeros(shape, np.uint8)
    for ax in range(3):
        fwd = np.cumsum(surf, axis=ax, dtype=np.int32) > 0
        back = np.flip(np.cumsum(np.flip(surf, ax), axis=ax, dtype=np.int32) > 0, ax)
        votes += fwd & back
    solid = surf | (votes >= 2)
    print("solid voxels", int(solid.sum()), "shell voxels", int(surf.sum()), flush=True)
    # the opening by distances (a ball structuring element is far slower on this many voxels)
    core = ndimage.distance_transform_edt(solid, sampling=h) > P["open"]
    grown = ndimage.distance_transform_edt(~core, sampling=h)
    opened = grown <= P["open"]
    near = grown <= P["open"] + P["thin"]
    ci = np.clip(np.floor((C - lo) / h).astype(int), 0, shape - 1)
    thin = ~near[ci[:, 0], ci[:, 1], ci[:, 2]]
    print("thin faces", int(thin.sum()), "of", len(thin), flush=True)
    # the opened solid's surface, only where the solid lost something (the stand-in goes there)
    # only the pieces the opening took off whole (the scaffold), not the slivers it shaved off every edge
    pieces, n = ndimage.label(solid & ~opened)
    size = np.bincount(pieces.ravel())
    big = np.nonzero(size >= P["min_piece"] / h ** 3)[0]
    big = big[big > 0]
    print("pieces taken off", n, "kept as scaffold", len(big), sorted((size[big] * h ** 3).round(2))[::-1][:10], flush=True)
    scaffold = np.isin(pieces, big)
    del pieces
    if P.get("open2"):
        # a second pass inside the scaffold's zones only: struts lying within a few tenths of a metre of the body
        # survive the first opening, so round where the scaffold was found the solid is opened far harder
        zone = ndimage.distance_transform_edt(~scaffold, sampling=h) <= P["zone_pad"]
        core2 = ndimage.distance_transform_edt(solid & zone, sampling=h) > P["open2"]
        opened2 = ndimage.distance_transform_edt(~core2, sampling=h) <= P["open2"]
        del core2
        opened = np.where(zone, opened2, opened)
        del opened2
        cut = solid & ~opened & zone
        pieces2, n2 = ndimage.label(cut)
        size2 = np.bincount(pieces2.ravel())
        keep2 = np.nonzero(size2 >= P["min_piece2"] / h ** 3)[0]
        keep2 = keep2[keep2 > 0]
        scaffold |= np.isin(pieces2, keep2)
        del pieces2, cut
        near = ndimage.distance_transform_edt(~opened, sampling=h) <= P["thin"]
        thin = ~near[ci[:, 0], ci[:, 1], ci[:, 2]]
        print("second pass: zones", int(zone.sum() * h ** 3), "m3; pieces", n2, "kept", len(keep2), flush=True)
    lost = ndimage.distance_transform_edt(~scaffold, sampling=h) <= P["reach"]
    thin &= (ndimage.distance_transform_edt(~scaffold, sampling=h) <= 2 * h)[ci[:, 0], ci[:, 1], ci[:, 2]]
    print("thin faces on the scaffold", int(thin.sum()), flush=True)
    box = tuple(slice(max(0, i.min() - 3), i.max() + 4) for i in np.nonzero(lost))
    field = ndimage.gaussian_filter(opened[box].astype(np.float32), 0.8)
    field[~lost[box]] = 0.0
    pv, pt, _, _ = measure.marching_cubes(field, 0.5, spacing=(h, h, h))
    pv += lo + h * np.array([s.start for s in box])
    print("stand-in", len(pt), "triangles", flush=True)
    # a core: the solid shrunk a little inside the stone, so that through any hole the shell is left with (a crack, a
    # cavity the second pass dug) one sees recessed stone, lit through the opening, not the hollow's black inside
    cv, ct = np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int32)
    if P.get("core"):
        inside = ndimage.distance_transform_edt(solid, sampling=h) > P["core"]
        cf = ndimage.gaussian_filter(inside.astype(np.float32), 0.8)
        del inside
        cv, ct, _, _ = measure.marching_cubes(cf, 0.5, spacing=(h, h, h), step_size=2)
        cv += lo
        print("core", len(ct), "triangles", flush=True)
    np.savez(dst, thin=thin, pverts=pv.astype(np.float32), ptris=pt.astype(np.int32),
             cverts=cv.astype(np.float32), ctris=ct.astype(np.int32))


if __name__ == "__main__":
    main(*sys.argv[1:4])
