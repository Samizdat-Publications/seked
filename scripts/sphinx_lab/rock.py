"""
The long rains' Sphinx cut as rock, not smoothed as clay: a candidate for the lab (scripts/sphinx_lab/).

    blender -b --factory-startup -P scripts/sphinx_lab/rock.py -- --tag c01 [--era lion] [--set KEY=VALUE ...]

The old long-rains lion (render/giza/sphinx_eras.py) pushed every point of the master inward along its normal
and then smoothed the whole mesh, which wiped out the bedding and dragged the Meshy mesh's thin flaps about
(the critic: "melted wax", "a wooden maquette", 3/10). This one starts from the same First Time lion
(build/models/sphinx-master-first-time/), and:

1. rebuilds it as a signed-distance field (Blender's SDF grid nodes) in metres: a closing fills the undercuts
   under the paws and fuses them to a slab of floor, an opening takes off any flap thinner than it, and the
   slab is then cut away, so the paws stand on the floor and nothing thinner than stone sticks out;
2. wears it back bed by bed, in metres, along a smoothed horizontal normal: the soft beds of Member II into
   rounded coves, the hard beds left standing as ledges with rounded lips, thin laminae inside the soft beds,
   vertical joints opened from the top, blocky spalls where the stone has broken out along its joints, and a
   grain over all of it; the head (Member III's hard bed) only pitted, and Member I at the foot worn smooth;
3. writes the bed each point is cut in as a colour attribute, "strata" (R: hard 1 to soft 0; G: how deep the
   point is worn, of the deepest; B: the member, I 0, II 0.5, III 1), which the render's limestone material
   (render/giza/limestone.py) turns into the rock's colour, so the colour and the relief are the same beds.

Writes build/models/sphinx-master-<era>-<tag>/model.glb and era.json, which lab_sheet.py renders with
`--finish <era>-<tag>`. Every number in PARAMS is a look choice; the members' thicknesses at the foot are
Lehner's (render/giza/weathering.py) and the seven beds of Member II AERA's. Nothing of it is a measurement.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "render"))
from giza import data, weathering  # noqa: E402
from giza.sphinx import BLENDER_DIR  # noqa: E402

if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)
import render_standins as rs  # noqa: E402

MODELS = os.path.join(REPO, "build", "models")

PARAMS = {
    "voxel": 0.07,          # m, the SDF's voxel
    "close": 0.25,          # m, the closing that fills undercuts and fuses the paws to the floor
    "open": 0.18,           # m, the opening that takes off flaps thinner than about twice this
    "soft": 1.6,           # m, how deep a soft bed's cove is worn at its middle
    "edge": 0.5,           # m, the recession where a soft bed meets a hard one
    "hard": 0.18,           # m, a hard bed's face at its middle, standing out as a ledge
    "neck": 0.55,           # m, Member III's softer neck
    "head": 0.06,           # m, the hard head: pitted, not worn back
    "member_i": 0.22,       # m, the foot and the forelegs
    "lamina": 0.12,         # m, the thin harder laminae inside a soft bed
    "laminae": 3,           # how many in each soft bed
    "bed_jitter": 0.35,     # of the mean bed thickness: how uneven the seven beds are
    "bed_wave": 0.18,       # m, how far a bed boundary wanders along the body
    "dip": 0.012,           # the beds' dip along the body (rise over run, a look choice)
    "along_var": 0.45,      # how much each bed's wear varies along the body (of itself)
    "joint_spacing": 4.2,   # m
    "joint_dist": "exponential",
    "joint_widths": False,  # whether each joint opens to its own width
    "joint_depth": 1.5,     # m at the top of the body
    "joint_width": (0.12, 0.4),   # m half-width at the foot and at the top
    "spall": 0.26,          # m, the deepest blocky break-out
    "spall_cell": 2.2,      # m, the size of the blocks that break out
    "grain": 0.035,         # m, the grain's amplitude
    "back_drop": 0.35,      # m, how much the top of the back is lowered and furrowed by runoff
    "slab_cut": 0.16,       # m: what is left of the floor slab under this goes (about two voxels)
    "belly_u": 0.72,        # fill under the body behind this fraction of the length (the chest; the forelegs stay free)
    "belly_cell": 0.3,
    "belly_max": 3.2,
    "belly_inset": 1.0,     # m: the fill set back inside the body's outline
    "tail_h": 1.0,          # m: the tail's relief stands no higher than this       # m: only an underside lower than this is belly; higher, it is an overhang      # m, the columns that fill it
    "hard_share": 0.55,     # a hard bed's thickness against a soft one's
    "joint_skip": 0.35,     # the chance a joint stops short of the foot
    "back_to": 11.6,        # m: the top of the back raised to this (the master's is 9.8; Member III's root at 12.5)
    "neck_top": 15.0,       # m: the widening fades out from the back up to here, so the head keeps its own width
    "head_rise": 1.2,       # m: how far the crown rises with the raised back
    "widen": 1.3,           # the body widened towards ARCE's 19.1 m (the master's is 14.3), the head not
    "head_u": 0.5,
    "fore_u": 0.78,         # from here forward and under fore_z, the forelegs and paws: worn smooth, no beds
    "fore_z": 5.5,         # along the body, from here forward and above the back, the head and neck: no beds cut
    "fracture": 0.22,
    "lip_break": 0.35,      # m, the deepest chunk broken out of a ledge's lip
    "head_lines": 0.045,
    "head_grain": 0.0,    # m, the hard head's pitting and grain
    "chips": 0.14,          # m, the small chips along every hard edge
    "foot_wave": 0.16,      # m, the worn foot's undulation    # m, the faint bedding lines across the hard head
    "head_line_step": 0.8,  # m between them
    "fore_blend": 1.5,      # m over which the head's treatment gives way to the body's       # m, the facets a hard bed's face breaks into
    "faces": 1400000,       # the written mesh's faces
    "seed": 7,
}


# The First Time's lion is the same rock on the day it was finished: dressed, every edge crisp, the beds showing
# only as a faint step and their colour, the joints as hairlines, nothing broken out (look choices).
ERA_PARAMS = {
    "lion": {},
    "first-time": {"soft": 0.07, "edge": 0.05, "hard": 0.02, "neck": 0.02, "head": 0.0, "member_i": 0.0,
                   "lamina": 0.015, "along_var": 0.15, "joint_depth": 0.12, "joint_width": (0.04, 0.07),
                   "spall": 0.0, "fracture": 0.0, "lip_break": 0.0, "chips": 0.0, "foot_wave": 0.0,
                   "grain": 0.008, "back_drop": 0.0, "head_lines": 0.012},
}


# ---------------------------------------------------------------- noise, in numpy

def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def value_noise(p, seed=0):
    """Smooth value noise in [0, 1] at points p (N, 3)."""
    f = np.floor(p).astype(np.int64)
    t = p - f
    t = t * t * (3 - 2 * t)
    out = np.zeros(len(p))
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out += w * _hash(f[:, 0] + dx, f[:, 1] + dy, f[:, 2] + dz, seed)
    return out


def fbm(p, octaves=4, seed=0):
    out, amp, tot = np.zeros(len(p)), 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(p * (2 ** o), seed + o * 17)
        tot += amp
        amp *= 0.5
    return out / tot


def voronoi(p, seed=0):
    """F1 cell id (a random value in [0, 1]) and F2 - F1 (the distance to the cell's edge) on a jittered grid."""
    f = np.floor(p).astype(np.int64)
    d1 = np.full(len(p), np.inf)
    d2 = np.full(len(p), np.inf)
    cid = np.zeros(len(p))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = f + np.array([dx, dy, dz])
                jit = np.stack([_hash(c[:, 0], c[:, 1], c[:, 2], seed + k) for k in range(3)], axis=1)
                d = np.linalg.norm(c + jit - p, axis=1)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                cid = np.where(closer, _hash(c[:, 0], c[:, 1], c[:, 2], seed + 9), cid)
                d1 = np.where(closer, d, d1)
    return cid, d2 - d1


# ---------------------------------------------------------------- the mesh

def first_time():
    src = os.path.join(MODELS, "sphinx-master-first-time", "model.glb")
    rec = json.load(open(os.path.join(MODELS, "sphinx-master-first-time", "era.json"), encoding="utf-8"))
    mesh = rs.import_model(src, "first time")
    bm = bmesh.new()
    bm.from_mesh(mesh)
    rs.largest_part(bm)
    bm.to_mesh(mesh)
    bm.free()
    s = rec["scale_m_per_unit"]
    mesh.transform(Matrix.Scale(s, 4))
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    shift = -np.array([(co[:, 0].min() + co[:, 0].max()) / 2, (co[:, 1].min() + co[:, 1].max()) / 2, co[:, 2].min()])
    mesh.transform(Matrix.Translation(shift))
    return mesh, s, shift


def proportion(mesh, P):
    """The master's body raised and widened towards the monument's, the head left as drawn: the back's top from
    where the master has it up to P["back_to"], the neck taking up the difference below P["neck_top"], and the
    body widened by P["widen"], fading out up the neck (look choices, towards ARCE's height and width)."""
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    along = -co[:, 1]
    u = (along - along.min()) / np.ptp(along)
    z = co[:, 2]
    body = u < P["head_u"]
    back = float(np.percentile(z[body & (u > 0.1)], 99))
    k = P["back_to"] / back
    # above the back, neck and head rise together, gently compressed so the crown rises by head_rise: squeezing the
    # whole rise into the neck sat the lion's head low on the raised body like a cap (sphinx-side, 22 October)
    crown = float(z.max())
    a = (crown + P["head_rise"] - P["back_to"]) / (crown - back)
    z2 = np.where(z <= back, z * k, P["back_to"] + (z - back) * a)
    top = P["neck_top"]
    fade = np.clip((top - z) / (top - back), 0.0, 1.0)
    w = 1.0 + (P["widen"] - 1.0) * fade
    cx = (co[:, 0].min() + co[:, 0].max()) / 2
    co[:, 0] = cx + (co[:, 0] - cx) * w
    co[:, 2] = z2
    mesh.vertices.foreach_set("co", co.ravel())
    mesh.update()
    print(f"proportioned: back {back:.2f} -> {P['back_to']} m, crown {crown:.2f} -> {crown + P['head_rise']:.2f} m, widened {P['widen']}", flush=True)


def rebuild(mesh, P):
    """The mesh as an SDF, closed onto a floor slab and opened, back to a mesh, the slab cut away."""
    obj = bpy.data.objects.new("rock", mesh)
    bpy.context.scene.collection.objects.link(obj)
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    size = (np.ptp(co[:, 0]) + 6, np.ptp(co[:, 1]) + 6, 2.0)
    ng = bpy.data.node_groups.new("sdf", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi, go = N.new("NodeGroupInput"), N.new("NodeGroupOutput")
    band = int(math.ceil(max(P["close"], P["open"]) / P["voxel"])) + 4

    def sdf(sock):
        n = N.new("GeometryNodeMeshToSDFGrid")
        n.inputs["Voxel Size"].default_value = P["voxel"]
        n.inputs["Band Width"].default_value = band
        L.new(sock, n.inputs["Mesh"])
        return n.outputs["SDF Grid"]

    def offset(sock, dist):
        n = N.new("GeometryNodeSDFGridOffset")
        n.inputs["Distance"].default_value = dist
        L.new(sock, n.inputs["Grid"])
        return n.outputs["Grid"]

    fill = N.new("GeometryNodeObjectInfo")
    fill.inputs["Object"].default_value = belly(co, P)   # None leaves the socket empty
    fill.transform_space = "RELATIVE"
    cube = N.new("GeometryNodeMeshCube")
    cube.inputs["Size"].default_value = size
    move = N.new("GeometryNodeTransform")
    move.inputs["Translation"].default_value = (0.0, 0.0, -1.0)
    L.new(cube.outputs["Mesh"], move.inputs["Geometry"])
    union = N.new("GeometryNodeSDFGridBoolean")
    union.operation = "UNION"
    multi = next(s for s in union.inputs if s.is_multi_input)   # a union takes its grids on one multi-input socket
    L.new(sdf(gi.outputs[0]), multi)
    L.new(sdf(move.outputs["Geometry"]), multi)
    L.new(sdf(fill.outputs["Geometry"]), multi)
    g = union.outputs["Grid"]
    g = offset(offset(g, P["close"]), -P["close"])       # closing: undercuts filled, paws fused to the floor
    g = offset(offset(g, -P["open"]), P["open"])         # opening: flaps thinner than the stone taken off
    tm = N.new("GeometryNodeGridToMesh")
    L.new(g, tm.inputs["Grid"])
    L.new(tm.outputs["Mesh"], go.inputs[0])
    mod = obj.modifiers.new("sdf", "NODES")
    mod.node_group = ng
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="sdf")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # the slab: everything at or under the floor goes, leaving the statue's foot fused to where it stood
    drop = [v for v in bm.verts if v.co.z < P["slab_cut"]]
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    rs.largest_part(bm)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def belly(co, P):
    """Columns from under the floor up into the statue's underside, wherever the body hangs over the floor
    behind the chest: the statue is cut from the rock it lies on, and the Meshy lion's belly does not touch it."""
    c = P["belly_cell"]
    along = -co[:, 1]
    u = (along - along.min()) / np.ptp(along)
    keep = u < P["belly_u"]
    ix = np.floor(co[keep, 0] / c).astype(int)
    iy = np.floor(co[keep, 1] / c).astype(int)
    z = co[keep, 2]
    cells = {}
    # the lowest underside above the tail's height: the tail lies on the floor under the haunch, and the gap
    # between it and the body is a cave, not stone
    up = z > P["tail_h"]
    for a, b, zz in zip(ix[up], iy[up], z[up]):
        k = (a, b)
        if zz < cells.get(k, np.inf):
            cells[k] = zz
    # set back inside the body's outline by `belly_inset` (a binary erosion of the filled cells), so the fill
    # stays under the belly and the flank's lowest bed still overhangs it; its top smoothed over the cells round it
    # every cell the body covers counts for the outline, touching the floor or not
    covered = set(zip(ix.tolist(), iy.tolist()))
    keys = [k for k, zz in cells.items() if 0.05 <= zz <= P["belly_max"]]
    if not keys:
        return None
    ka = np.array(list(covered))
    off = ka.min(axis=0)
    shape = ka.max(axis=0) - off + 1
    top = np.full(shape, np.nan)
    for (a, b) in keys:
        top[a - off[0], b - off[1]] = cells[(a, b)]
    filled = np.zeros(shape, dtype=bool)
    for (a, b) in covered:
        filled[a - off[0], b - off[1]] = True
    k = max(1, int(round(P["belly_inset"] / c)))
    inner = filled.copy()
    for dx in range(-k, k + 1):
        for dy in range(-k, k + 1):
            sh = np.zeros_like(filled)
            xs, ys = slice(max(dx, 0), shape[0] + min(dx, 0)), slice(max(dy, 0), shape[1] + min(dy, 0))
            xd, yd = slice(max(-dx, 0), shape[0] + min(-dx, 0)), slice(max(-dy, 0), shape[1] + min(-dy, 0))
            sh[xd, yd] = filled[xs, ys]
            inner &= sh
    has = ~np.isnan(top)
    tz = np.where(has, top, 0.0)
    w = has.astype(float)
    acc, wacc = np.zeros(shape), np.zeros(shape)
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            acc += np.roll(np.roll(tz, dx, 0), dy, 1)
            wacc += np.roll(np.roll(w, dx, 0), dy, 1)
    smooth = acc / np.maximum(wacc, 1e-9)
    bm = bmesh.new()
    n = 0
    for i, j in zip(*np.nonzero(inner & has)):
        a, b = i + off[0], j + off[1]
        top_z = min(smooth[i, j], top[i, j]) + 0.35
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res["verts"]:
            v.co.x = (a + 0.5 + v.co.x * 1.2) * c
            v.co.y = (b + 0.5 + v.co.y * 1.2) * c
            v.co.z = -0.5 + (v.co.z + 0.5) * (top_z + 0.5)
        n += 1
    me = bpy.data.meshes.new("belly")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("belly", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.hide_render = True
    print(f"belly: {n} columns", flush=True)
    return ob


def neighbours_mean(vals, edges, n, iters=1):
    """Average a per-vertex array over its one-ring, `iters` times (the vertex itself counts once)."""
    a, b = edges[:, 0], edges[:, 1]
    deg = np.bincount(a, minlength=n) + np.bincount(b, minlength=n) + 1.0
    out = vals.copy()
    for _ in range(iters):
        acc = out.copy()
        if out.ndim == 1:
            np.add.at(acc, a, out[b])
            np.add.at(acc, b, out[a])
            out = acc / deg
        else:
            np.add.at(acc, a, out[b])
            np.add.at(acc, b, out[a])
            out = acc / deg[:, None]
    return out


def beds(P, length, height, rng):
    """Member II's seven beds as boundaries (m above the floor at the rump end), soft first, uneven."""
    top_i = weathering.MEMBER_I_TOP
    base_iii = weathering.MEMBER_III_BASE * height
    n = weathering.MEMBER_II_BEDS
    th = 1.0 + P["bed_jitter"] * rng.uniform(-1, 1, n)
    th = th / th.sum()
    return top_i, base_iii, th


def wear(obj, P, height):
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    edges = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", edges)
    edges = edges.reshape(-1, 2)
    me.update()
    nor = np.empty(n * 3)
    me.vertices.foreach_get("normal", nor)
    nor = nor.reshape(-1, 3)
    snor = neighbours_mean(nor, edges, n, iters=12)      # about a metre of smoothing: the face's way, not the grain's
    snor /= np.maximum(np.linalg.norm(snor, axis=1, keepdims=True), 1e-9)
    rng = np.random.default_rng(P["seed"])
    # u along the body, rump 0 to forepaws 1: the statue faces -y in the master's frame
    along = -co[:, 1]
    u = (along - along.min()) / np.ptp(along)
    length = np.ptp(along)
    x = along - along.min()                              # metres from the rump
    z = co[:, 2]
    top_i_rump, top_i_paws = weathering.MEMBER_I_TOP
    top_i = top_i_rump + (top_i_paws - top_i_rump) * u
    base_iii = weathering.MEMBER_III_BASE * height
    hard_iii = weathering.MEMBER_III_HARD * height
    # the beds wander and dip along the body
    wave = P["bed_wave"] * (2 * fbm(np.stack([x / 9.0, np.zeros(n), np.zeros(n) + 3.3], 1), 3, P["seed"]) - 1)
    zb = z + wave - P["dip"] * (x - length / 2)
    nb = weathering.MEMBER_II_BEDS
    th = (1.0 + P["bed_jitter"] * rng.uniform(-1, 1, nb)) * np.where(np.arange(nb) % 2 == (0 if weathering.MEMBER_II_SOFT_FIRST else 1), 1.0, P["hard_share"])
    cum = np.concatenate([[0.0], np.cumsum(th / th.sum())])
    t2 = np.clip((zb - top_i) / np.maximum(base_iii - top_i, 1e-6), 0.0, 0.999999)
    bed = np.searchsorted(cum, t2, side="right") - 1
    tb = (t2 - cum[bed]) / (cum[bed + 1] - cum[bed])    # 0 at a bed's foot, 1 at its top
    soft = (bed % 2 == 0) if weathering.MEMBER_II_SOFT_FIRST else (bed % 2 == 1)
    in_ii = (zb >= top_i) & (zb < base_iii)
    # each bed's wear varies along the body by its own noise
    var = 1.0 + P["along_var"] * (2 * fbm(np.stack([x / 11.0, bed * 3.1, np.zeros(n)], 1), 3, P["seed"] + 5) - 1)         + 0.5 * P["along_var"] * (2 * fbm(np.stack([x / 2.5, bed * 5.3, z / 2.0], 1), 2, P["seed"] + 6) - 1)
    var = np.clip(var, 0.35, 1.8)
    s = np.sin(np.pi * tb)
    cove = P["edge"] + (P["soft"] - P["edge"]) * s ** 0.6
    lam = np.abs(np.sin(np.pi * tb * (P["laminae"] + 1)))          # thin harder laminae inside a soft bed
    cove -= P["lamina"] * (1 - lam) ** 6 * s
    ledge = P["hard"] + (P["edge"] - P["hard"]) * (1 - s) ** 4
    d = np.where(soft, cove, ledge) * var
    hardness = np.where(soft, 0.15 + 0.25 * (1 - lam) ** 6, 0.8)
    # Member I at the foot, Member III's neck and head
    in_i = (zb < top_i) | ((u > P["fore_u"]) & (z < P["fore_z"]))
    fore = (u > P["head_u"]) & (z > P["back_to"] - 0.6)
    neck = (zb >= base_iii) & (z < hard_iii) & ~fore
    head = (z >= hard_iii) | fore
    # how fully a point is the head's: rising over fore_blend above the back and behind head_u, so the
    # hard head gives way to the beds gradually, not along a seam
    headness = np.clip((z - (P["back_to"] - 0.6)) / P["fore_blend"], 0, 1) * np.clip((u - P["head_u"]) / 0.04 + 0.5, 0, 1)
    headness = np.maximum(headness, (z >= hard_iii).astype(float))
    blend = np.clip((z - base_iii) / 1.2, 0, 1)                    # the neck takes over from the top bed
    d = np.where(in_i, P["member_i"] * var, d)
    d = np.where(neck, P["neck"] * var * blend + d * (1 - blend), d)
    lines = P["head_lines"] * np.clip(1 - np.abs(((zb / P["head_line_step"]) % 1.0) - 0.5) / 0.08, 0, 1)
    d = d * (1 - headness) + (P["head"] + lines) * headness
    hardness = np.where(in_i, 0.9, np.where(neck, 0.5, np.where(head, 1.0, hardness)))
    member = np.where(in_i, 0.0, np.where(z < base_iii, 0.5, 1.0))
    # how a face is turned: horizontal faces take the rain's wear; under an overhang, less
    nz = snor[:, 2]
    expo = np.where(nz >= 0, 1.0, 0.75 + 0.25 * (1 + nz))
    d *= np.where(head, 1.0, expo)
    # the top of the back: lowered and furrowed by runoff across it
    back = (nz > 0.6) & (z > top_i + 2) & ~head
    furrow = fbm(np.stack([x / 4.0, co[:, 0] / 1.8, np.zeros(n)], 1), 2, P["seed"] + 11)
    d = np.where(back, d * 0.5 + P["back_drop"] * (0.7 + 0.6 * furrow), d)
    # vertical joints from the top, wandering a little as they go down
    if P["joint_dist"] == "lognormal":
        at = np.cumsum(rng.lognormal(np.log(P["joint_spacing"]) - 0.4, 0.9, int(4 * length / P["joint_spacing"])))
    else:
        at = np.cumsum(rng.exponential(P["joint_spacing"], int(3 * length / P["joint_spacing"])))
    at = at[at < length]
    nj = len(at)
    jdepth = rng.uniform(0.3, 1.0, nj)
    jwide = rng.lognormal(0.0, 0.45, nj)            # some joints opened into channels, most hairlines
    jfoot = np.where(rng.uniform(0, 1, nj) < P["joint_skip"], rng.uniform(0.3, 0.8, nj), 0.0)
    wander = 0.5 * (2 * fbm(np.stack([z / 3.0, x / 30.0, np.zeros(n) + 7.7], 1), 2, P["seed"] + 3) - 1)
    hf = np.clip((z - top_i) / np.maximum(base_iii - top_i, 1e-6), 0, 1)
    half = P["joint_width"][0] + (P["joint_width"][1] - P["joint_width"][0]) * hf
    groove = np.zeros(n)
    for j in range(nj):
        reach = np.clip((hf - jfoot[j]) / max(1 - jfoot[j], 1e-6), 0, 1)
        g = P["joint_depth"] * jdepth[j] * np.sqrt(reach) * np.clip(1 - np.abs(x + wander - at[j]) / (half * (jwide[j] if P["joint_widths"] else 1.0)), 0, 1) ** 1.5
        groove = np.maximum(groove, g)
    d += np.where((z > top_i) & ~head, groove, 0.0)
    # blocky spalls: whole blocks of the soft stone broken out along their joints
    cid, edge = voronoi(co / P["spall_cell"] * np.array([1.0, 1.0, 2.2]), P["seed"] + 21)
    spall = P["spall"] * (cid > 0.55) * ((cid - 0.55) / 0.45) * np.clip(edge * 4, 0, 1) ** 0.3
    d += np.where((in_ii | neck) & (np.abs(nz) < 0.5), spall * (1.3 - hardness), 0.0)   # off the faces, not the tops
    # the hard beds' faces broken into facets: each block of stone set back by its own amount
    fid, _ = voronoi(co / 1.4 * np.array([1.0, 1.0, 1.8]), P["seed"] + 41)
    d += np.where(in_ii & ~soft & (np.abs(nz) < 0.6), P["fracture"] * fid, 0.0)
    # the ledges' lips broken out in angular chunks, deepest at the lip and none in the ledge's middle
    lid, ledge_edge = voronoi(co / 0.9 * np.array([1.0, 1.0, 1.6]), P["seed"] + 51)
    lip = np.clip(1 - s / 0.5, 0, 1)
    d += np.where(in_ii & ~soft & (np.abs(nz) < 0.7), P["lip_break"] * lip * (lid > 0.4) * (lid - 0.4) / 0.6, 0.0)
    # small chips along every hard edge, and the worn foot's undulation
    cid2, _ = voronoi(co / 0.45, P["seed"] + 61)
    d += np.where(in_ii & ~soft, P["chips"] * np.clip((cid2 - 0.6) / 0.4, 0, 1) * (0.4 + 0.6 * lip), 0.0)
    d += np.where(in_i, P["foot_wave"] * fbm(co / 1.6, 3, P["seed"] + 71), 0.0)
    d += headness * P["head_grain"] * fbm(co / 0.25, 3, P["seed"] + 81)
    # the grain
    d += P["grain"] * (2 * fbm(co / 0.45, 4, P["seed"] + 31) - 1) * np.where(head, 0.0, np.where(in_i, 0.5, 1.0))
    d = np.maximum(d, 0.0)
    d = neighbours_mean(d, edges, n, iters=1)
    # worn back along the smoothed normal, mostly level: rain cuts a face back, it does not sink it
    dirn = snor.copy()
    dirn[:, 2] *= np.where(back, 1.0, 0.35)
    dirn /= np.maximum(np.linalg.norm(dirn, axis=1, keepdims=True), 1e-9)
    moved = co - dirn * d[:, None]
    # the cut foot, all round, flat on the floor: the renderer sets the statue down by its lowest point, so
    # one low point at the rump would leave the paws standing a hand's breadth over the floor
    foot = co[:, 2] < P["slab_cut"] + 0.12
    moved[foot, 2] = np.minimum(moved[foot, 2], 0.0) * 0.0
    moved[:, 2] = np.maximum(moved[:, 2], 0.0)
    me.vertices.foreach_set("co", moved.ravel())
    me.update()
    # the strata the material reads
    attr = me.color_attributes.new("strata", "FLOAT_COLOR", "POINT")
    col = np.stack([hardness, d / max(d.max(), 1e-6), member, np.ones(n)], 1)
    attr.data.foreach_set("color", col.astype(np.float32).ravel())
    me.color_attributes.active_color = attr
    return {"deepest_m": round(float(d.max()), 3), "median_m": round(float(np.median(d)), 3), "joints": nj}


def decimate(obj, faces):
    have = len(obj.data.polygons)
    if have <= faces:
        return have
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.ratio = faces / have
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="dec")
    return len(obj.data.polygons)


def main(argv):
    args = {}
    sets = []
    i = 0
    while i < len(argv):
        if argv[i] == "--set":
            sets.append(argv[i + 1])
            i += 2
        elif argv[i].startswith("--"):
            args[argv[i]] = argv[i + 1] if i + 1 < len(argv) else True
            i += 2
        else:
            i += 1
    P = dict(PARAMS)
    P.update(ERA_PARAMS[args.get("--era", "lion")])
    for kv in sets:
        k, v = kv.split("=", 1)
        P[k] = json.loads(v)
    era = args.get("--era", "lion")
    tag = args.get("--tag", "rock")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    height = {r["key"]: r["value"] for r in data.records("g2-g3-sphinx.json")}["sphinx.height"]
    mesh, scale, shift = first_time()
    print(f"first time: {len(mesh.vertices)} vertices", flush=True)
    proportion(mesh, P)
    obj = rebuild(mesh, P)
    print(f"rebuilt as rock: {len(obj.data.vertices)} vertices, {len(obj.data.polygons)} faces", flush=True)
    rec = wear(obj, P, height)
    print(f"worn: {rec}", flush=True)
    rec["faces"] = decimate(obj, P["faces"])
    obj.data.shade_smooth()
    # a plain material, so the exporter has one; the render's limestone replaces it
    mat = bpy.data.materials.new("rock")
    obj.data.materials.append(mat)
    out = os.path.join(MODELS, f"sphinx-master-{era}-{tag}", "model.glb")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_vertex_color="ACTIVE",
                              export_normals=True)
    record = {"master": "sphinx-master", "era": era, "tag": tag, "made_by": "scripts/sphinx_lab/rock.py",
              "from": "sphinx-master-first-time", "params": P, **rec,
              "note": "every parameter is a look choice; nothing of the form is a measurement"}
    json.dump(record, open(os.path.join(os.path.dirname(out), "era.json"), "w", encoding="utf-8"), indent=1)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
