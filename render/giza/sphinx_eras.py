"""
The Sphinx's eras, cut from one master (docs/rethink-2026-10.md, "The Sphinx: one master, subtracted").

    blender -b --factory-startup -P render/giza/sphinx_eras.py -- [--eras first-time,lion] [--master sphinx-master]

The lions used to disagree between eras because each was its own Meshy generation. Now the First Time's
lion (`sphinx-master` in blender/models.json) is the master, and each later Sphinx is made from it here,
so the eras are one statue at different ages:

- **first-time** (c. 10,500 BCE): the master, welded, lengthened and subdivided once, otherwise untouched.
  Lengthened because the image model drew a shorter lion than the monument (2.5 : 1 against the ARCE
  3.6 : 1, `sphinx.length` over `sphinx.height`): the flank and the forelegs are stretched along the body
  and the haunch, the head and the paws are left as drawn, as the lion before it was lengthened in 2D
  (a look choice; where the zones fall is read off the mesh's own height profile).
- **lion** (c. 7000 BCE): the long rains. Each point recedes by the bed it is cut in, by how much it faces
  the sky and by the vertical joints (render/giza/weathering.py: the beds are sourced, the rates look
  choices), and the profile is then rounded, the way rain rounds an arris.
- **built** (c. 2500 BCE): further wear of the same kind, and the king's head (`sphinx-king-head`)
  carved inside the lion's. First the head-fit test: the largest king's head, standing where the lion's
  stood or as far fore or aft of it as ALONG allows, whose every point lies inside the weathered lion head;
  the centred fit is recorded beside it. That is the steelman's account of why
  the head is small, as a number (`fit` in era.json), read off two stand-ins and no more than that.
  The carving uses the centred fit (CARVE_WITH): the searched one fits a larger head only by setting it
  back and down, and carved at that size it is not the monument's head.
  Then the carving: the lion head's surface is drawn onto the king's head (Blender's Shrinkwrap), fully
  above the jaw and fading out down the neck and chest. The lion's faces there are then cut away, and
  the king's head, with its own texture, closes the hole exactly at the cut.
- **today**: the as-built statue, king's head and all, worn on by what the rains and the wind took since
  (weathering.further), so the head fit stays the 2500 BCE number it is; then the losses and the repairs:
  the nose, chiselled off flat to the cheeks; the beard's socket, a scar on the chest under the chin; and
  the masonry that cases the lower body and the paws, a different stone that wears no further. Their sizes
  are look choices (LOSSES below, written into era.json).

Each era is written to build/models/<master>-<era>/model.glb in the master's own frame, as a "finish" of
the master: sphinx.statue fits it to the footprint exactly as it fits the master, so every era stands in
the same place at the same size. The master's own texture rides along (the vertices move, the UVs stay),
and the render lays the enclosure's bedrock over it as it does for the other lions.

Nothing of the master's form is a measurement, and nor is any era's: they illustrate the claim's account
of how the statue aged.
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from giza import data, profile, weathering  # noqa: E402
from giza.sphinx import BLENDER_DIR  # noqa: E402

if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)
import render_standins as rs  # noqa: E402

MODELS = os.path.join(data.REPO, "build", "models")
ERAS = ("first-time", "lion", "built", "today")
# Rounding after the recession: Laplacian passes, more the longer the stone stood (look choices).
ROUNDING = {"first-time": 0, "lion": 3, "built": 4, "today": 6}
# How the length the master lacks is shared between the flank and the forelegs (look choices).
STRETCH_SHARE = {"flank": 0.8, "forelegs": 0.2}     # about 2.7 and 1.4 times, near the old lion's 2D stretch
# The lion's head enlarged (night item 36, Stewart's answer 6 of 20 October). On the master as drawn, the largest king's
# head its worn lion head holds is short of the monument's own (sphinx.head.height, chin to crown). So the king's head is
# carved at the monument's size, its crown at the monument's top (sphinx.height) and set fore or aft as the searched fit
# is, and the lion's head and mane are scaled about the
# head's foot (profile.enlarge_head) by the least factor that holds it wholly inside: `--solve-head` finds it on the worn
# built lion and writes the search to build/models/<master>-headscale.json. A look choice, and H1's receipt. The scale
# fades in up the neck from CARVE_FROM to CARVE_FULL and along HEAD_BEHIND of the body behind the head (look choices).
HEAD_SCALE = 1.17           # --solve-head: least 1.162, the head 1.71 m aft; a little over it, as the build wears after enlarging
HEAD_BEHIND = 0.08


def zones(u, h):
    """Where the flank and the forelegs lie along the body, read off the height profile: the head is the
    profile's peak; the flank is the run behind it where the back stays level; the forelegs run from where
    the profile drops in front of the head to the paws, the last eighth."""
    bins = np.linspace(0.0, 1.0, 81)
    top = np.array([h[(u >= a) & (u < b)].max() if ((u >= a) & (u < b)).any() else 0.0 for a, b in zip(bins[:-1], bins[1:])])
    mid = (bins[:-1] + bins[1:]) / 2
    head = mid[np.argmax(top)]
    back = np.median(top[(mid > 0.1) & (mid < head - 0.2)])
    level = (top > 0.95 * back) & (top < 1.06 * back) & (mid < head)
    ahead = mid[(mid > head) & (top < 0.35)]
    return {"flank": (mid[level].min() + 0.03, mid[level].max() - 0.03),
            "forelegs": ((ahead.min() if len(ahead) else head + 0.1) + 0.01, 0.875)}


def lengthen(co, axis, sign, ratio):
    """Stretch the flank and the forelegs along the body until its length is `ratio` times its height."""
    along = co[:, axis] * sign
    a0, span = along.min(), np.ptp(along)
    u = (along - a0) / span
    h = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    extra = ratio * np.ptp(co[:, 2]) - span
    if extra <= 0:
        return co, {}
    z = zones(u, h)
    shift = np.zeros(len(u))
    for name, (lo, hi) in z.items():
        k = 1.0 + STRETCH_SHARE[name] * extra / ((hi - lo) * span)
        # inside the zone a point moves by how far into it it lies; past it, by the whole stretch
        shift += (k - 1.0) * np.clip(u - lo, 0.0, hi - lo) * span
    out = co.copy()
    out[:, axis] = (along + shift) * sign
    return out, {name: (round(lo, 3), round(hi, 3)) for name, (lo, hi) in z.items()}


def ground_truth():
    """The ARCE height and length the master is scaled to (arce-sphinx-1991, unverified)."""
    rec = {r["key"]: r["value"] for r in data.records("g2-g3-sphinx.json")}
    return rec["sphinx.height"], rec["sphinx.length"]


def welded(path, name):
    """The master's meshes as one welded bmesh: UV seams joined, so a displaced surface cannot crack along them."""
    mesh = rs.import_model(path, name, keep_materials=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return mesh, bm


def head_target():
    """The monument's head, chin to crown, in metres (sphinx.head.height, scaled off ARCE's south elevation)."""
    return {r["key"]: r["value"] for r in data.records("g2-g3-sphinx.json")}["sphinx.head.height"]


def derive(bm, era, front="-y", head_scale=None):
    """Lengthen the welded master `bm` to the ARCE proportions, enlarge its head by `head_scale` (HEAD_SCALE if None)
    and wear it to `era`, in place. The frame, and so the metres, are the master's as drawn: the lion's top as drawn
    is the monument's height, and an enlarged head stands above it."""
    height, length_arce = ground_truth()
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    co = np.array([v.co[:] for v in bm.verts])
    co, stretched = lengthen(co, axis, sign, length_arce / height)
    for v, c in zip(bm.verts, co):
        v.co = c
    print(f"lengthened to {length_arce / height:.2f} : 1 through {stretched}")
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    along = co[:, axis] * sign                       # grows towards the face
    scale = height / np.ptp(co[:, 2])                # metres per model unit
    length = np.ptp(along) * scale
    # the frame later wear is measured in, fixed before any wear moves the statue's extremes
    frame = {"axis": axis, "sign": sign, "a0": along.min(), "aspan": np.ptp(along), "z0": co[:, 2].min(),
             "zspan": np.ptp(co[:, 2]), "scale": scale, "height": height, "length": length}
    f = HEAD_SCALE if head_scale is None else head_scale
    frame["head_scale"] = f
    if f != 1.0:
        co, pivot = profile.enlarge_head(co, frame, f, CARVE_FROM, CARVE_FULL, HEAD_BEHIND)
        for v, c in zip(bm.verts, co):
            v.co = c
        bm.normal_update()
        print(f"head enlarged {f:.3f} times about {pivot.round(4).tolist()}")
    nor = np.array([v.normal[:] for v in bm.verts])
    along = co[:, axis] * sign
    u = (along - frame["a0"]) / frame["aspan"]       # rump 0, forepaws 1
    h = (co[:, 2] - frame["z0"]) / frame["zspan"]    # above 1 in an enlarged head
    d = weathering.recession(u, h, nor[:, 2], era, height, length) / scale
    if d.any():
        d, nor = held(bm, co, nor, d)
    moved = co - nor * d[:, None]
    for v, c in zip(bm.verts, moved):
        v.co = c
    for _ in range(ROUNDING[era]):
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    return float(d.max() * scale), float(np.median(d) * scale), frame


def wear_on(bm, frame, since, era):
    """Wear the statue in `bm`, as it stood in era `since`, on to `era`, in place; the masonry casing wears no
    further. Returns the further recession's deepest and median in metres, and which points are cased."""
    f = frame
    bm.verts.index_update()
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    nor = np.array([v.normal[:] for v in bm.verts])
    u = (co[:, f["axis"]] * f["sign"] - f["a0"]) / f["aspan"]
    h = (co[:, 2] - f["z0"]) / f["zspan"]
    cased = weathering.masonry(u, h, f["height"])
    d = weathering.further(u, h, nor[:, 2], since, era, f["height"], f["length"]) / f["scale"]
    d[cased] = 0.0
    d, nor = held(bm, co, nor, d)
    d[cased] = 0.0                                   # the casing stands proud of the stone worn back above it
    for v, c in zip(bm.verts, co - nor * d[:, None]):
        v.co = c
    # the rounding the longer wear adds, on the body only: the head is sound stone and the casing is cut
    body = [v for v, hh, c in zip(bm.verts, h, cased) if hh < CARVE_FROM and not c]
    for _ in range(ROUNDING[era] - ROUNDING[since]):
        bmesh.ops.smooth_vert(bm, verts=body, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    worn = d[d > 0]
    return float(d.max() * f["scale"]), float((np.median(worn) if len(worn) else 0.0) * f["scale"]), cased


# Today's losses, as fractions of the king's bust (its height from the cut foot to the crown, and its width
# across) and in metres (look choices, read off the king's head's own front profile): the nose, from the
# upper lip to the bridge, chiselled flat to the cheeks either side of it; the beard's socket, a scar on the
# chest under the chin where the beard was set, which the king's head stand-in has no beard to leave.
LOSSES = {"nose": {"from": 0.50, "to": 0.68, "half_width": 0.07, "cheeks": (0.10, 0.16)},
          "beard_socket": {"from": 0.12, "to": 0.38, "half_width": 0.06, "depth_m": 0.35}}


def losses(bm, frame, king):
    """Take today's losses off the king's head and chest in `bm`; `king` marks the king head's vertices."""
    f = frame
    bm.verts.index_update()
    co = np.array([v.co[:] for v in bm.verts])
    fwd = co[:, f["axis"]] * f["sign"]
    kco = co[king]
    kz0, kspan = kco[:, 2].min(), np.ptp(kco[:, 2])
    kz = (co[:, 2] - kz0) / kspan
    mid = np.median(kco[:, 1 - f["axis"]])
    off = np.abs(co[:, 1 - f["axis"]] - mid) / np.ptp(kco[:, 1 - f["axis"]])
    nor = np.array([v.normal[:] for v in bm.verts])
    facing = nor[:, f["axis"]] * f["sign"] > 0.4
    n = LOSSES["nose"]
    band = king & (kz > n["from"]) & (kz < n["to"])
    cheeks = band & facing & (off > n["cheeks"][0]) & (off < n["cheeks"][1])      # the cheeks' faces, not the nemes behind them
    plane = np.percentile(fwd[cheeks], 95)          # their front: the nemes folds behind face forward too
    nose = band & (off < n["half_width"]) & (fwd > plane)
    b = LOSSES["beard_socket"]
    box = (kz > b["from"]) & (kz < b["to"]) & (off < b["half_width"]) & facing & (fwd > plane - 0.25 * kspan)
    t = np.clip(1.0 - off / b["half_width"], 0, 1) * np.sin(np.pi * np.clip((kz - b["from"]) / (b["to"] - b["from"]), 0, 1))
    sink = np.where(box, b["depth_m"] / f["scale"] * np.sqrt(t), 0.0)
    for i, v in enumerate(bm.verts):
        if nose[i] or sink[i] > 0:
            c = v.co.copy()
            a = plane if nose[i] else fwd[i] - sink[i]
            c[f["axis"]] = a * f["sign"]
            v.co = c
    bm.normal_update()
    return {"nose_points": int(nose.sum()), "nose_m": round(float((fwd[nose].max() - plane) * f["scale"]), 2) if nose.any() else 0.0,
            "beard_socket_points": int(box.sum()), **LOSSES}


# A point may recede by at most this share of the stone behind it, so a nose, a lappet's edge or a toe wears
# thinner rather than folding through itself (a look choice); and the recession and the normals are averaged
# over this many rings of neighbours, so neighbouring points move together.
THIN = 0.3
SPREAD = 3


def held(bm, co, nor, d):
    """The recession `d`, capped by the thickness of the stone behind each point and smoothed over the mesh,
    and the normals it is applied along, smoothed the same way."""
    from mathutils.bvhtree import BVHTree
    tree = BVHTree.FromBMesh(bm)
    thick = np.full(len(co), np.inf)
    for i, v in enumerate(bm.verts):
        if d[i] > 0:
            hit = tree.ray_cast(v.co - v.normal * 1e-5, -v.normal)
            if hit[0] is not None:
                thick[i] = hit[3]
    d = np.minimum(d, THIN * thick)
    edges = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])
    degree = np.bincount(edges.ravel(), minlength=len(co)).astype(float)
    for _ in range(SPREAD):
        total = np.zeros(len(co)); vec = np.zeros_like(nor)
        np.add.at(total, edges[:, 0], d[edges[:, 1]]); np.add.at(total, edges[:, 1], d[edges[:, 0]])
        np.add.at(vec, edges[:, 0], nor[edges[:, 1]]); np.add.at(vec, edges[:, 1], nor[edges[:, 0]])
        d = 0.5 * d + 0.5 * total / np.maximum(degree, 1.0)
        nor = 0.5 * nor + 0.5 * vec / np.maximum(degree, 1.0)[:, None]
        nor /= np.maximum(np.linalg.norm(nor, axis=1), 1e-9)[:, None]
    return np.minimum(d, THIN * thick), nor


# The lion's head, as fractions of the statue's height: carved fully above CARVE_FULL, fading out to
# CARVE_FROM, where the lappets lie on the chest; and the margin the king's head keeps inside the lion's
# surface, in metres (look choices).
CARVE_FROM, CARVE_FULL = 0.36, 0.60
KING_MARGIN = 0.15
KING_TEST_FROM = 0.45      # of the king's bust's height: the fit is tested on the head and nemes above this
RAMP = 0.35                # of the stretch from CARVE_FROM up to the king head's foot: the last part, ramped onto the bust
# The fit is searched fore and aft as well as up and down: the king's head may stand this far, as a share of the
# lion's upper head's length, towards the face or the back of it (a look choice: the search's reach and its steps).
ALONG = np.linspace(-0.25, 0.25, 11)
CARVE_WITH = "monument"    # or "searched" or "centred": which head the carving uses (all three are in era.json); decisions 54 and 83
# The plain chest: under the king's bust the front is laid to a straight slope from the bust's foot down to the
# chest where the carving starts, in bins across the chest; a front point up to CHEST_FILL in metres behind that
# slope is brought onto it (the hollows), and one in front of it is cut back (the collar the ramp leaves at the
# bust's foot); between CHEST_FILL and twice it behind, a point is brought part of the way. The slope is one
# surface across the chest (the bins' fronts run through a five-bin mean and interpolated), it fades out across
# the outer fifth either side of the bust's width, and the points moved are then smoothed (look choices).
CHEST_BINS = 24
CHEST_FILL = 0.6
CHEST_SMOOTH = 12
PLAIN = 200                # smoothing passes that carve the lion's mane off the chest, fewest lowest: about a metre of diffusion on this mesh


def inside(tree, points, up=(0.0, 0.0, 1.0)):
    """Which points lie inside the closed-ish surface in `tree`: an odd number of crossings straight up."""
    from mathutils import Vector
    out = np.zeros(len(points), dtype=bool)
    d = Vector(up)
    for i, p in enumerate(points):
        o, n = Vector(p), 0
        for _ in range(64):
            hit = tree.ray_cast(o, d)
            if hit[0] is None:
                break
            n += 1
            o = hit[0] + d * 1e-5
        out[i] = n % 2 == 1
    return out


def king_head(path, front):
    """The king's head as a bmesh in its own frame: its largest part, with the lower bust (below a quarter of
    its height) cut off, and the beard. Meshy gave it a plaited beard that neither view has, and the beard
    is generally dated centuries after Khafre: it is the central column under the chin standing proud of
    the chest, measured beside it and inside the lappets."""
    mesh = rs.import_model(path, "king head", keep_materials=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    rs.largest_part(bm)
    co = np.array([v.co[:] for v in bm.verts])
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    fwd = co[:, axis] * sign                       # grows towards the face
    across = co[:, 1 - axis]
    zr = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    width = np.ptp(across)
    off = np.abs(across - (across.min() + across.max()) / 2) / width
    chest = (off > 0.10) & (off < 0.16) & (zr > 0.30) & (zr < 0.50)
    chest_front = np.percentile(fwd[chest], 98) if chest.any() else fwd.max()
    # The beard stops short of the bust's cut, so its hole and the open foot are two holes, not one: run into
    # the foot, the beard's hole let the inside of the bust show as a grey plate at its foot.
    beard = (off < 0.07) & (zr > 0.28) & (zr < 0.56) & (fwd > chest_front + 0.01 * np.ptp(co[:, 2]))
    drop = beard | (zr < 0.25)
    bmesh.ops.delete(bm, geom=[v for v, d in zip(bm.verts, drop) if d], context="VERTS")
    # Close the hole the beard leaves under the chin, and only that: a cap on the bust's foot stood out as a
    # shelf wherever the lion's chest falls short of the bust. The patch takes the material of the faces round it.
    open_edges = [e for e in bm.edges if e.is_boundary]
    loops, seen = [], set()
    for e in open_edges:
        if e in seen:
            continue
        loop, todo = [], [e]
        while todo:
            x = todo.pop()
            if x in seen:
                continue
            seen.add(x)
            loop.append(x)
            todo += [y for v in x.verts for y in v.link_edges if y.is_boundary and y not in seen]
        loops.append(loop)
    foot_loop = min(loops, key=lambda lp: np.mean([v.co.z for x in lp for v in x.verts]))
    rest = [x for lp in loops if lp is not foot_loop for x in lp]
    filled = bmesh.ops.holes_fill(bm, edges=rest, sides=0)["faces"] if rest else []
    for f in filled:
        near = [lf.material_index for e in f.edges for lf in e.link_faces if lf is not f]
        if near:
            f.material_index = max(set(near), key=near.count)
    bmesh.ops.triangulate(bm, faces=filled, quad_method="BEAUTY", ngon_method="BEAUTY")
    print(f"king's head: {len(filled)} holes closed")
    print(f"king's head: {int(beard.sum())} points of beard cut away")
    return mesh, bm


def at_monument(co, frame, kco0, drop=0.0, fore=0.0):
    """The king's head points `kco0` at the monument's size, chin to crown sphinx.head.height, its crown `drop` under
    the lion's crown less KING_MARGIN, centred in the lion's upper head in `co` side to side and fore and aft but for
    `fore` (towards the face), as `carve`'s `placed` sets a head."""
    axis, sign = frame["axis"], frame["sign"]
    h = (co[:, 2] - frame["z0"]) / frame["zspan"]
    along = co[:, axis] * sign
    upper = h > 0.72
    chin, crown = profile.chin_to_crown(kco0[:, axis] * sign, kco0[:, 1 - axis], kco0[:, 2])
    k = kco0 * (head_target() / frame["scale"] / (crown - chin))
    ka = k[:, axis] * sign
    kz = (kco0[:, 2] - kco0[:, 2].min()) / np.ptp(kco0[:, 2])
    face_part = (kz >= KING_TEST_FROM) & (kz > 0.6)
    shift = np.zeros(3)
    shift[axis] = sign * ((along[upper].min() + along[upper].max()) / 2 + fore - (ka[face_part].min() + ka[face_part].max()) / 2)
    shift[2] = (co[h > CARVE_FULL, 2].max() - KING_MARGIN / frame["scale"] - drop) - k[:, 2].max()
    shift[1 - axis] = np.median(co[upper, 1 - axis]) - np.median(k[kz >= KING_TEST_FROM, 1 - axis])
    return k + shift


def monument_fit(co, frame, kco0, test, tree):
    """Where the king's head at the monument's size lies inside the lion's head in `co` (its BVH `tree`) with its
    crown at the monument's top (sphinx.height, the frame's), searched fore and aft over ALONG as `carve`'s `fits`
    searches: (drop under the lion's crown less the margin, fore, share inside) or None. The shift nearest the
    centre wins."""
    axis, sign = frame["axis"], frame["sign"]
    h = (co[:, 2] - frame["z0"]) / frame["zspan"]
    along = co[:, axis] * sign
    upper = h > 0.72
    drop = co[h > CARVE_FULL, 2].max() - KING_MARGIN / frame["scale"] - (frame["z0"] + frame["zspan"])
    if drop < 0.0:
        return None                          # the lion's crown, less the margin, is under the monument's
    for fore in sorted(ALONG * np.ptp(along[upper]), key=abs):
        pts = at_monument(co, frame, kco0, drop, fore)[test]
        got = float(inside(tree, pts[:: max(1, len(pts) // 3000)]).mean())
        if got > 0.995:
            return (drop, fore, got)
    return None


def carve(bm, king_path, front, frame):
    """Fit the king's head inside the worn lion head in `bm` and carve the lion's head down to it. Returns
    the head-fit record and the placed king's head (mesh, bmesh) to join."""
    from mathutils import Matrix, Vector
    from mathutils.bvhtree import BVHTree
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    scale_m = frame["scale"]
    co = np.array([v.co[:] for v in bm.verts])
    z0, zspan = frame["z0"], frame["zspan"]
    h = (co[:, 2] - z0) / zspan
    along = co[:, axis] * sign
    head = h > CARVE_FULL
    face = along[head].max()                    # the lion's face, furthest forward
    top = co[head, 2].max()
    mid_x = np.median(co[head, 1 - axis])
    lion_h = top - (z0 + CARVE_FULL * zspan)
    margin = KING_MARGIN / scale_m
    tree = BVHTree.FromBMesh(bm)

    kmesh, kbm = king_head(king_path, front)
    kco0 = np.array([v.co[:] for v in kbm.verts])
    kz = (kco0[:, 2] - kco0[:, 2].min()) / np.ptp(kco0[:, 2])
    test = kz >= KING_TEST_FROM              # the head and the nemes, not the shoulders the lappets fall on
    k_h = np.ptp(kco0[test, 2])
    upper = h > 0.72                         # the lion's upper head, the brow to the crown
    lion_fore = (along[upper].min() + along[upper].max()) / 2
    upper_len = np.ptp(along[upper])
    lion_across = np.median(co[upper, 1 - axis])

    def placed(s, drop=0.0, fore=0.0):
        """The king's head scaled so its head and nemes are s of the lion head's height, its crown `margin`
        plus `drop` under the lion's, centred side to side in the lion's upper head and fore and aft but for
        `fore` (towards the face)."""
        k = kco0 * (s * lion_h / k_h)
        ka = k[:, axis] * sign
        face_part = test & (kz > 0.6)
        shift = np.zeros(3)
        shift[axis] = sign * (lion_fore + fore - (ka[face_part].min() + ka[face_part].max()) / 2)
        shift[2] = (top - margin - drop) - k[:, 2].max()
        shift[1 - axis] = lion_across - np.median(k[test, 1 - axis])
        return k + shift

    def fits(s, fores):
        """The highest the king's head can stand at size s and lie wholly inside the lion's, as (a drop below
        the lion's crown, a shift fore or aft), or None. The carvers would have kept the crown as high as the
        stone allowed; of equal drops, the shift nearest the centre wins."""
        best = None
        for fore in sorted(fores, key=abs):
            for drop in np.linspace(0.0, 0.5 * lion_h, 13):
                if best is not None and drop >= best[0]:
                    break
                pts = placed(s, drop, fore)[test]
                if inside(tree, pts[:: max(1, len(pts) // 3000)]).mean() > 0.995:
                    best = (drop, fore)
                    break
            if best is not None and best[0] == 0.0:
                break
        return best

    def largest(fores, label):
        lo, hi, best = 0.2, 1.5, None
        for _ in range(14):
            s = (lo + hi) / 2
            got = fits(s, fores)
            print(f"  {label}: king's head at {s:.3f} of the lion's: " + ("fits" if got is not None else "does not fit")
                  + (f", crown {got[0] * scale_m:.2f} m under the lion's, {got[1] * scale_m:+.2f} m fore" if got is not None else ""))
            if got is not None:
                lo, best = s, got
            else:
                hi = s
        if best is None:
            raise SystemExit("the king's head fits at no size: the placement is wrong, not the claim")
        return lo, best

    def record(s, best):
        # chin to crown as well, the measure ARCE's south elevation gives the monument's head (sphinx.head.height)
        k = placed(s, *best)
        chin, crown = profile.chin_to_crown(k[:, axis] * sign, k[:, 1 - axis], k[:, 2])
        return {"scale_of_lion_head": round(float(s), 3), "lion_head_m": round(float(lion_h * scale_m), 2),
                "king_head_m": round(float(s * lion_h * scale_m), 2), "crown_drop_m": round(float(best[0] * scale_m), 2),
                "fore_m": round(float(best[1] * scale_m), 2), "margin_m": KING_MARGIN,
                "chin_to_crown_m": round(float((crown - chin) * scale_m), 2)}

    # The search fore and aft, and the centred fit beside it, so the gain from searching is on the record.
    s, best = largest(ALONG * upper_len, "searched")
    s0, best0 = largest([0.0], "centred")
    mfit = monument_fit(co, frame, kco0, test, tree)
    if mfit is None and CARVE_WITH == "monument":
        raise SystemExit(f"the monument's head fits nowhere in a lion head enlarged {frame.get('head_scale', 1.0)} times: solve again (--solve-head)")
    mon = at_monument(co, frame, kco0, *(mfit[:2] if mfit else (0.0, 0.0)))
    kco = {"searched": lambda: placed(s, *best), "centred": lambda: placed(s0, *best0), "monument": lambda: mon}[CARVE_WITH]()
    for v, c in zip(kbm.verts, kco):
        v.co = c
    fit = record(s, best)
    fit["carved_with"] = CARVE_WITH
    fit["searched_fore_m"] = [round(float(ALONG[0] * upper_len * scale_m), 2), round(float(ALONG[-1] * upper_len * scale_m), 2)]
    fit["centred"] = record(s0, best0)
    m_chin, m_crown = profile.chin_to_crown(mon[:, axis] * sign, mon[:, 1 - axis], mon[:, 2])
    fit["monument"] = {"chin_to_crown_m": round(float((m_crown - m_chin) * scale_m), 2), "target_m": head_target(),
                       "crown_m": round(float((mon[:, 2].max() - z0) * scale_m), 2),
                       "crown_drop_m": round(float(mfit[0] * scale_m), 2) if mfit else None,
                       "fore_m": round(float(mfit[1] * scale_m), 2) if mfit else None,
                       "inside_share": round(mfit[2], 4) if mfit else None,
                       "head_scale": frame.get("head_scale", 1.0), "head_behind": HEAD_BEHIND,
                       "head_scale_from_to": [CARVE_FROM, CARVE_FULL]}

    # Carve. Above the king head's foot, the lion's head is drawn onto the king's: each point moves to the king
    # head's nearest surface. Below the foot the lion's mane is carved off into a plain broad chest: its points
    # are smoothed, more the higher they are, and in the last stretch under the foot they ramp onto the king's
    # bust, so its shoulders slope into the chest rather than standing on a shelf.
    ktree = BVHTree.FromBMesh(kbm)
    foot_z = kco[:, 2].min()
    z_from = z0 + CARVE_FROM * zspan
    z_ramp = foot_z - RAMP * (foot_z - z_from)
    near_head = along > along[head].min() - 0.05 * np.ptp(along)        # the back and the haunch stay
    w = np.zeros(len(co))
    smooth = []
    for i, v in enumerate(bm.verts):
        z = v.co.z
        if not near_head[i] or z <= z_from:
            continue
        if z >= z_ramp:
            hit = ktree.find_nearest(v.co)
            if hit[0] is not None:
                t = 1.0 if z >= foot_z else ((z - z_ramp) / (foot_z - z_ramp)) ** 1.5
                v.co = v.co.lerp(hit[0], t)
                w[i] = t
        if z < foot_z:
            smooth.append((v, (z - z_from) / (foot_z - z_from)))
    for step in range(PLAIN):
        verts = [v for v, t in smooth if t * PLAIN > step]
        bmesh.ops.smooth_vert(bm, verts=verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    plain_chest(bm, kco, w, near_head, axis, sign, z_from, foot_z, scale_m)
    # Cut away the lion's faces that now lie on the king's surface, so the king's own (and its texture) show.
    core = [f for f in bm.faces if all(w[v.index] >= 1.0 for v in f.verts)]
    bmesh.ops.delete(bm, geom=core, context="FACES")
    bm.normal_update()
    return fit, (kmesh, kbm)


def plain_chest(bm, kco, w, near_head, axis, sign, z_from, foot_z, scale_m):
    """Lay the chest under the king's bust to a plain slope (CHEST_BINS, CHEST_FILL, CHEST_SMOOTH), in place."""
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    nor = np.array([v.normal[:] for v in bm.verts])
    fwd, across = co[:, axis] * sign, co[:, 1 - axis]
    k_fwd, k_across = kco[:, axis] * sign, kco[:, 1 - axis]
    foot = kco[:, 2] < foot_z + 0.08 * np.ptp(kco[:, 2])
    lo, hi = k_across[foot].min(), k_across[foot].max()
    mid, half = (lo + hi) / 2, (hi - lo) / 2
    edges = np.linspace(lo, hi, CHEST_BINS + 1)
    centres = (edges[:-1] + edges[1:]) / 2

    def front(values, where):
        """The front in each bin across the chest, gaps filled and run through a five-bin mean, so the slope
        is one surface across the chest and not a row of slabs."""
        out = np.full(CHEST_BINS, np.nan)
        b = np.clip(np.searchsorted(edges, where, side="right") - 1, 0, CHEST_BINS - 1)
        for i in range(CHEST_BINS):
            if (b == i).any():
                out[i] = values[b == i].max()
        ok = ~np.isnan(out)
        out = np.interp(centres, centres[ok], out[ok])
        pad = np.pad(out, 2, mode="edge")
        return np.convolve(pad, np.ones(5) / 5, mode="valid")
    top = front(k_fwd[foot], k_across[foot])
    base_band = near_head & (np.abs(co[:, 2] - z_from) < 0.01 * (foot_z - z_from)) & (nor[:, axis] * sign > 0.3)
    bottom = front(fwd[base_band], across[base_band])
    fill = CHEST_FILL / scale_m
    moved = []
    for i, v in enumerate(bm.verts):
        z = co[i, 2]
        # front-facing points, and the shelves facing up that the ramp leaves at the bust's foot
        facing = nor[i, axis] * sign >= 0.2 or nor[i, 2] >= 0.7
        if not near_head[i] or w[i] >= 1.0 or z <= z_from or z >= foot_z or not facing:
            continue
        if abs(across[i] - mid) >= half:
            continue
        t = (z - z_from) / (foot_z - z_from)
        slope = np.interp(across[i], centres, bottom) + t * (np.interp(across[i], centres, top) - np.interp(across[i], centres, bottom))
        gap = slope - fwd[i]                     # behind the slope if positive
        reach = np.clip((2.0 * fill - gap) / fill, 0.0, 1.0)  # fully up to CHEST_FILL behind, none past twice it
        side = np.clip((1.0 - abs(across[i] - mid) / half) / 0.2, 0.0, 1.0)
        k = side * reach
        if k <= 0.0:
            continue
        c = v.co.copy()
        c[axis] = (fwd[i] + k * gap) * sign
        v.co = c
        moved.append(v)
    for _ in range(CHEST_SMOOTH):
        bmesh.ops.smooth_vert(bm, verts=moved, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    print(f"plain chest: {len(moved)} points laid to the slope")


def write(mesh, bm, path):
    bm.to_mesh(mesh)
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    bpy.data.objects.remove(obj, do_unlink=True)


def solve_head(source, master, front, lo=1.0, hi=1.5, steps=9):
    """The least head scale at which the king's head at the monument (at_monument) lies wholly inside the worn
    built lion's head: bisection on profile.enlarge_head over the worn mesh, written beside the eras."""
    from mathutils.bvhtree import BVHTree
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh, bm = welded(source, f"{master} solve")
    _, _, frame = derive(bm, "built", front, head_scale=1.0)
    co = np.array([v.co[:] for v in bm.verts])
    polys = [[v.index for v in f.verts] for f in bm.faces]
    _, kbm = king_head(os.path.join(MODELS, "sphinx-king-head", "model.glb"), front)
    kco0 = np.array([v.co[:] for v in kbm.verts])
    kz = (kco0[:, 2] - kco0[:, 2].min()) / np.ptp(kco0[:, 2])
    test = kz >= KING_TEST_FROM

    def placed_at(f):
        cf, _ = profile.enlarge_head(co, frame, f, CARVE_FROM, CARVE_FULL, HEAD_BEHIND)
        return monument_fit(cf, frame, kco0, test, BVHTree.FromPolygons(cf.tolist(), polys))
    trace = []
    for _ in range(steps):
        f = (lo + hi) / 2
        got = placed_at(f)
        trace.append([round(f, 4)] + ([round(float(got[0] * frame["scale"]), 2), round(float(got[1] * frame["scale"]), 2)] if got else [None, None]))
        print(f"head scale {f:.3f}: " + (f"fits, crown {trace[-1][1]} m down, {trace[-1][2]:+} m fore" if got else "does not fit"))
        if got:
            hi = f
        else:
            lo = f
    out = {"master": master, "least_head_scale": round(hi, 4), "held_when": "more than 0.995 of the head and nemes inside",
           "placed": "the crown at the monument's top (sphinx.height); searched fore and aft over ALONG, as the searched fit is",
           "target_m": head_target(), "trace (scale, crown drop m, fore m)": trace,
           "made_by": "render/giza/sphinx_eras.py --solve-head"}
    with open(os.path.join(MODELS, f"{master}-headscale.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print(f"least head scale: {hi:.4f}")


def main(argv):
    args = dict(zip(argv[::2], argv[1::2]))
    master = args.get("--master", "sphinx-master")
    if "--solve-head" in argv:
        models = {m["id"]: m for m in data.load_json(BLENDER_DIR, "models.json")["models"]}
        return solve_head(os.path.join(MODELS, master, "model.glb"), master, models[master].get("front", "-y"))
    eras = args.get("--eras", ",".join(ERAS)).split(",")
    models = {m["id"]: m for m in data.load_json(BLENDER_DIR, "models.json")["models"]}
    model = models[master]
    source = os.path.join(MODELS, master, "model.glb")
    if not os.path.exists(source):
        sys.exit(f"{source} is not on disk: python scripts/models.py finds it")
    for era in eras:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mesh, bm = welded(source, f"{master} {era}")
        deepest, median, frame = derive(bm, "built" if era == "today" else era, model.get("front", "-y"))
        fit = extra = None
        if era in ("built", "today"):
            king = os.path.join(MODELS, "sphinx-king-head", "model.glb")
            if not os.path.exists(king):
                sys.exit(f"{king} is not on disk: python scripts/models.py finds it")
            fit, (kmesh, kbm) = carve(bm, king, model.get("front", "-y"), frame)
            # The king's head joins the statue with its own material.
            offset = len(mesh.materials)
            for mat in kmesh.materials:
                mesh.materials.append(mat)
            for f in kbm.faces:
                f.material_index += offset
            tmp = bpy.data.meshes.new("king placed")
            kbm.to_mesh(tmp)
            bm.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
            kbm.free()
            print(f"head fit: {fit}")
        if era == "today":
            # today is the as-built statue worn on, so the head fit above is the as-built one
            bm.verts.index_update()
            king = np.zeros(len(bm.verts), dtype=bool)
            for face in bm.faces:
                if face.material_index >= offset:
                    for v in face.verts:
                        king[v.index] = True
            further, further_median, cased = wear_on(bm, frame, "built", "today")
            lost = losses(bm, frame, king)
            # the casing is another stone: its faces take a material of their own, which the render dresses
            masonry = mesh.materials[0].copy()
            masonry.name = "masonry"
            mesh.materials.append(masonry)
            mi = len(mesh.materials) - 1
            n_cased = 0
            for face in bm.faces:
                if face.material_index < offset and all(cased[v.index] for v in face.verts):
                    face.material_index = mi
                    n_cased += 1
            extra = {"derived_from": "built", "since_built": {"deepest_m": round(further, 3), "median_m": round(further_median, 3)},
                     "masonry": {"faces": n_cased, "over_member_i_m": weathering.MASONRY_OVER_MEMBER_I}, "losses": lost}
            print(f"today: {extra}")
        out = os.path.join(MODELS, f"{master}-{era}", "model.glb")
        write(mesh, bm, out)
        bm.free()
        record = {"master": master, "era": era, "deepest_m": round(deepest, 3), "median_m": round(median, 3),
                  "vertices": len(mesh.vertices), "fit": fit, "scale_m_per_unit": round(float(frame["scale"]), 4),
                  "head_scale": frame["head_scale"], "head_scale_note": "the lion's head enlarged about its foot: a look choice (HEAD_SCALE, night item 36)",
                  "made_by": "render/giza/sphinx_eras.py"}
        if extra:
            record.update(extra)
        with open(os.path.join(os.path.dirname(out), "era.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)
        print(f"{master}-{era}: {out}, {len(mesh.vertices)} vertices, deepest {deepest:.2f} m, median {median:.2f} m")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
