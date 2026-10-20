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
  stood, whose every point lies inside the weathered lion head. That is the steelman's account of why
  the head is small, as a number (`fit` in era.json), read off two stand-ins and no more than that.
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
from giza import data, weathering  # noqa: E402
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


def derive(bm, era, front="-y"):
    """Lengthen the welded master `bm` to the ARCE proportions and wear it to `era`, in place."""
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
    nor = np.array([v.normal[:] for v in bm.verts])
    along = co[:, axis] * sign                       # grows towards the face
    u = (along - along.min()) / np.ptp(along)        # rump 0, forepaws 1
    h = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    scale = height / np.ptp(co[:, 2])                # metres per model unit
    length = np.ptp(along) * scale
    # the frame later wear is measured in, fixed before any wear moves the statue's extremes
    frame = {"axis": axis, "sign": sign, "a0": along.min(), "aspan": np.ptp(along), "z0": co[:, 2].min(),
             "zspan": np.ptp(co[:, 2]), "scale": scale, "height": height, "length": length}
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
    beard = (off < 0.07) & (zr > 0.20) & (zr < 0.56) & (fwd > chest_front + 0.01 * np.ptp(co[:, 2]))
    drop = beard | (zr < 0.25)
    bmesh.ops.delete(bm, geom=[v for v, d in zip(bm.verts, drop) if d], context="VERTS")
    # close the small hole the beard leaves under the chin (not the open foot of the bust)
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=48)
    print(f"king's head: {int(beard.sum())} points of beard cut away")
    return mesh, bm


def carve(bm, king_path, front, scale_m):
    """Fit the king's head inside the worn lion head in `bm` and carve the lion's head down to it. Returns
    the head-fit record and the placed king's head (mesh, bmesh) to join."""
    from mathutils import Matrix, Vector
    from mathutils.bvhtree import BVHTree
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    co = np.array([v.co[:] for v in bm.verts])
    z0, zspan = co[:, 2].min(), np.ptp(co[:, 2])
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
    lion_across = np.median(co[upper, 1 - axis])

    def placed(s, drop=0.0):
        """The king's head scaled so its head and nemes are s of the lion head's height, its crown `margin`
        plus `drop` under the lion's, centred fore and aft and side to side in the lion's upper head."""
        k = kco0 * (s * lion_h / k_h)
        ka = k[:, axis] * sign
        face_part = test & (kz > 0.6)
        shift = np.zeros(3)
        shift[axis] = sign * (lion_fore - (ka[face_part].min() + ka[face_part].max()) / 2)
        shift[2] = (top - margin - drop) - k[:, 2].max()
        shift[1 - axis] = lion_across - np.median(k[test, 1 - axis])
        return k + shift

    def fits(s):
        """The highest the king's head can stand at size s and lie wholly inside the lion's, as a drop below
        the lion's crown, or None. The carvers would have kept the crown as high as the stone allowed."""
        for drop in np.linspace(0.0, 0.5 * lion_h, 13):
            pts = placed(s, drop)[test]
            if inside(tree, pts[:: max(1, len(pts) // 3000)]).mean() > 0.995:
                return drop
        return None

    lo, hi, best = 0.2, 1.5, None
    for _ in range(14):
        s = (lo + hi) / 2
        drop = fits(s)
        print(f"  king's head at {s:.3f} of the lion's: " + ("fits" if drop is not None else "does not fit")
              + (f", crown {drop * scale_m:.2f} m under the lion's" if drop is not None else ""))
        if drop is not None:
            lo, best = s, drop
        else:
            hi = s
    s = lo
    if best is None:
        raise SystemExit("the king's head fits at no size: the placement is wrong, not the claim")
    kco = placed(s, best)
    for v, c in zip(kbm.verts, kco):
        v.co = c
    fit = {"scale_of_lion_head": round(float(s), 3), "lion_head_m": round(float(lion_h * scale_m), 2),
           "king_head_m": round(float(s * lion_h * scale_m), 2), "crown_drop_m": round(float(best * scale_m), 2),
           "margin_m": KING_MARGIN}

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
    # Cut away the lion's faces that now lie on the king's surface, so the king's own (and its texture) show.
    core = [f for f in bm.faces if all(w[v.index] >= 1.0 for v in f.verts)]
    bmesh.ops.delete(bm, geom=core, context="FACES")
    bm.normal_update()
    return fit, (kmesh, kbm)


def write(mesh, bm, path):
    bm.to_mesh(mesh)
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    bpy.data.objects.remove(obj, do_unlink=True)


def main(argv):
    args = dict(zip(argv[::2], argv[1::2]))
    master = args.get("--master", "sphinx-master")
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
            height, _ = ground_truth()
            zs = [v.co.z for v in bm.verts]
            fit, (kmesh, kbm) = carve(bm, king, model.get("front", "-y"), height / (max(zs) - min(zs)))
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
                  "made_by": "render/giza/sphinx_eras.py"}
        if extra:
            record.update(extra)
        with open(os.path.join(os.path.dirname(out), "era.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)
        print(f"{master}-{era}: {out}, {len(mesh.vertices)} vertices, deepest {deepest:.2f} m, median {median:.2f} m")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
