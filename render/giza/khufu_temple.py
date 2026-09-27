"""
Khufu's mortuary temple, on the rock bed of its basalt pavement.

The pavement's four corners are Petrie's (section 28, data/measurements/giza-temples.json,
g1.basalt_pavement.corner.*), measured north of Khufu's east-west axis and east of his
east base. Today the black basalt floor is most of what is left. As built it is the floor
of a court ringed with square granite pillars inside dressed limestone walls; the walls'
height, the pillars' pitch and the temple's reach beyond the pavement are look choices,
after the reconstructions of Lauer and Lehner.
"""
import math

import bpy

from . import data, materials, states
from .instancing import Field
from .nodes import Tree, hexlin
from .temples import DRESSED_BLOCK
from .walls import battered_variants, lay_masonry

WALL = 2.6          # look choices: wall thickness, height, pillar pitch and side
HEIGHT = 8.0
PILLAR_PITCH = 3.2
PILLAR_SIDE = 1.0


def pavement_corners():
    r = {rec["key"]: rec["value"] for rec in data.records("giza-temples.json")}
    east = data.PYRAMIDS["g1"]["half"]
    out = []
    for c in ("ne", "se", "sw", "nw"):
        out.append((east + r[f"g1.basalt_pavement.corner.{c}.beyond_east_base"], r[f"g1.basalt_pavement.corner.{c}.north"]))
    return out, r["g1.basalt_pavement.thickness"]


def flats(state):
    """The ground levelled under the temple, so the terrain's relief cannot rise through the basalt."""
    if states.spec(state)["pyramids"] not in ("today", "stripped", "dressed"):
        return []
    corners, _ = pavement_corners()
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return [(cx, cy, (max(xs) - min(xs)) / 2 + WALL + 4.0, (max(ys) - min(ys)) / 2 + WALL, data.PYRAMIDS["g1"]["base"])]


def basalt_material():
    """
    Khufu's basalt floor as the photographs show what is left of it: slabs of irregular outline, each
    a shade off the next and tilted a hair its own way, a dusty dark grey rather than black; the
    joints a finger wide and packed with sand; sand lying thicker against the walls and pillars and
    in drifts across the floor; the stone's own pitted grain in between (look choices; critic: "a real
    paved floor, no crushed blacks", and round 5 read a regular grid with bright grout as tile).
    """
    from . import materials
    mat = bpy.data.materials.new("basalt")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    # the slabs: a metre to two across, their outlines wandering a little
    warp = t.node("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    wn = t.node("ShaderNodeTexNoise")
    wn.inputs["Scale"].default_value = 0.9
    wn.inputs["Detail"].default_value = 2.0
    t.link(pos, wn.inputs["Vector"])
    t.link(wn.outputs["Color"], warp.inputs[0])
    warp.inputs[1].default_value = (0.12, 0.12, 0.0)
    t.link(pos, warp.inputs[2])
    slabs = t.node("ShaderNodeTexVoronoi")
    slabs.feature = "DISTANCE_TO_EDGE"
    slabs.inputs["Scale"].default_value = 0.65
    slabs.inputs["Randomness"].default_value = 0.85
    t.link(warp.outputs[0], slabs.inputs["Vector"])
    cell = t.node("ShaderNodeTexVoronoi")
    cell.inputs["Scale"].default_value = 0.65
    cell.inputs["Randomness"].default_value = 0.85
    t.link(warp.outputs[0], cell.inputs["Vector"])
    pick = t.node("ShaderNodeRGBToBW")
    t.link(cell.outputs["Color"], pick.inputs[0])
    edge = slabs.outputs["Distance"]
    # (distances are in the Voronoi's cells, 1.5 m each): the sand-packed joint about 1.5 cm across, and the
    # slab's worn edge beside it (at 3 and 8 cm they read as cartoon crazy paving underfoot)
    joint = t.math("SUBTRACT", 1.0, t.band(edge, 0.005, 0.011))
    lip = t.math("SUBTRACT", 1.0, t.band(edge, 0.011, 0.025))
    base = t.ramp(pick.outputs[0], [(0.0, hexlin("3d3c3a")), (0.3, hexlin("4f4d49")), (0.6, hexlin("353433")),
                                    (0.85, hexlin("59564f")), (1.0, hexlin("444240"))])
    # the stone's pitted grain, from the photograph, in world metres
    size = materials.TEX["core"]["tile_m"][0]
    mp = t.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size, 1 / size, 1 / size)
    t.link(pos, mp.inputs["Vector"])
    diff = t.node("ShaderNodeTexImage", image=materials.image("core", "Diffuse"))
    t.link(mp.outputs[0], diff.inputs["Vector"])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(diff.outputs["Color"], bw.inputs[0])
    grain = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", bw.outputs[0], 0.35), 2.4), 1.0)
    col = t.mix(1.0, base, t.grey(t.math("MAXIMUM", grain, 0.3)), "MULTIPLY")
    # the vesicles and pits of the lava, a couple of centimetres across, darker where dust has not filled them
    ves = t.node("ShaderNodeTexVoronoi")
    ves.inputs["Scale"].default_value = 55.0
    t.link(pos, ves.inputs["Vector"])
    pits = t.math("MULTIPLY", t.math("SUBTRACT", 1.0, t.band(ves.outputs["Distance"], 0.04, 0.14)),
                  t.band(t.noise(pos, 3.0, 2.0), 0.3, 0.6))
    col = t.mix(t.math("MULTIPLY", pits, 0.6), col, hexlin("1e1d1c"))
    # weathering at a finger's breadth and a hand's, so a slab underfoot is stone and not poured concrete
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 14.0, 6.0, 0.7), [(0.3, hexlin("a8a8a8")), (0.7, hexlin("ffffff"))]), "MULTIPLY")
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 2.5, 4.0, 0.6), [(0.3, hexlin("c4c4c4")), (0.7, hexlin("ffffff"))]), "MULTIPLY")
    # a film of dust everywhere, thicker in patches, and drifts of sand across the floor
    film = t.band(t.noise(pos, 0.5, 4.0, 0.6), 0.45, 0.78)
    col = t.mix(t.math("ADD", 0.03, t.math("MULTIPLY", film, 0.4)), col, hexlin("8f806a"))
    drift = t.band(t.noise(pos, 0.12, 5.0, 0.62), 0.56, 0.72)
    col = t.mix(t.math("MULTIPLY", drift, 0.85), col, hexlin("bda57d"))
    col = t.mix(t.math("MULTIPLY", lip, 0.15), col, hexlin("2f2d2a"))
    col = t.mix(t.math("MULTIPLY", joint, 0.6), col, hexlin("8e7a60"))
    # sand gathered against the walls and the pillars' feet
    ao = t.node("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 1.8
    banked = t.math("POWER", t.math("SUBTRACT", 1.0, ao.outputs["AO"]), 0.6)
    col = t.mix(t.math("MULTIPLY", banked, 0.75), col, hexlin("b59c76"))
    t.link(col, bsdf.inputs["Base Color"])
    sandy = t.math("MAXIMUM", t.math("MAXIMUM", drift, joint), banked)
    t.link(t.math("ADD", 0.5, t.math("MULTIPLY", sandy, 0.45)), bsdf.inputs["Roughness"])
    # relief: each slab tilted a hair its own way, its edge worn down, the joint sunk under the sand
    tilt = t.math("MULTIPLY", t.math("SUBTRACT", pick.outputs[0], 0.5), 0.02)
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    h = t.math("ADD", t.math("MULTIPLY", tilt, t.math("ADD", sep.outputs["X"], sep.outputs["Y"])),
               t.math("MULTIPLY", t.math("ADD", lip, joint), -0.008))
    h = t.math("ADD", h, t.math("MULTIPLY", t.noise(mp.outputs[0], 8.0, 4.0), 0.002))
    h = t.math("ADD", h, t.math("MULTIPLY", t.math("ADD", bw.outputs[0], t.math("MULTIPLY", pits, -0.5)), 0.004))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 1.0
    bmp.inputs["Distance"].default_value = 1.0
    t.link(h, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def build(state, rng, coll, mats, lib, log=print):
    S = states.spec(state)
    if S["pyramids"] not in ("today", "stripped", "dressed"):
        return
    corners, thick = pavement_corners()
    z = data.PYRAMIDS["g1"]["base"]
    verts = [(x, y, z + thick) for x, y in corners] + [(x, y, z - 0.4) for x, y in corners]
    faces = [(0, 1, 2, 3)[::-1], (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new("Khufu's basalt pavement")
    me.from_pydata(verts, [], faces)
    me.materials.append(basalt_material())
    ob = bpy.data.objects.new("Khufu's basalt pavement", me)
    coll.objects.link(ob)
    if S["pyramids"] != "dressed":
        log("Khufu's mortuary temple: the basalt pavement")
        return
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    x0, x1, y0, y1 = min(xs) - WALL, max(xs) + WALL + 4.0, min(ys) - WALL, max(ys) + WALL
    ring = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    materials.masonry_set(mats)
    walls = Field()
    # Dressed limestone laid as the period laid it (critic: "plain grey boxes with regular joints"): blocks
    # of different lengths and heights, the beds stepping, the faces leaning with the batter.
    # The walls stand outside the pavement, on the rock levelled round it: founded half a metre down, so
    # no daylight shows under them (it drew a bright seam along every wall's foot).
    foot = z - 0.5
    laid = lay_masonry(ring, foot, HEIGHT + z + thick - foot, rng, walls, course=1.05, block=2.3, depth=WALL, batter_deg=84.0,
                       openings=[(x1, 0.0, 4.0, 5.0 + z + thick - foot), (x0, 0.0, 6.0, 6.0 + z + thick - foot)], joint=0.012,
                       course_spread=0.28,
                       block_spread=0.45, min_len=0.8, max_course=1.9)
    walls.emit("Khufu's mortuary temple walls", battered_variants(lib, "limestone masonry", mats["limestone masonry"], **DRESSED_BLOCK),
               coll, log)
    pillars = Field()
    inner = (min(xs) + 3.0, max(xs) - 3.0, min(ys) + 3.0, max(ys) - 3.0)
    n_x = int((inner[1] - inner[0]) / PILLAR_PITCH)
    n_y = int((inner[3] - inner[2]) / PILLAR_PITCH)
    for i in range(n_x + 1):
        for j in range(n_y + 1):
            if 0 < i < n_x and 0 < j < n_y:
                continue          # a colonnade round the court, not a grid across it
            px = inner[0] + i * (inner[1] - inner[0]) / n_x
            py = inner[2] + j * (inner[3] - inner[2]) / n_y
            pillars.add((px, py, z + thick + (HEIGHT - 1.0) / 2), (0.0, 0.0, 0.0), (PILLAR_SIDE, PILLAR_SIDE, HEIGHT - 1.0),
                        rng.randrange(2), rng.random(), 0.0)
    # The colonnade carries granite architraves, a beam from each pillar to the next, and a limestone roof
    # spans from them to the walls, so the court is an open square ringed by a shaded walk (look choices
    # after Lauer's reconstruction).
    top = z + thick + HEIGHT - 1.0
    beam = 1.0
    xs_p = [inner[0] + i * (inner[1] - inner[0]) / n_x for i in range(n_x + 1)]
    ys_p = [inner[2] + j * (inner[3] - inner[2]) / n_y for j in range(n_y + 1)]
    for y_row in (inner[2], inner[3]):
        for a, b in zip(xs_p[:-1], xs_p[1:]):
            pillars.add(((a + b) / 2, y_row, top + beam / 2), (0.0, 0.0, 0.0), (b - a - 0.012, PILLAR_SIDE, beam),
                        rng.randrange(2), rng.random(), 0.0)
    for x_row in (inner[0], inner[1]):
        for a, b in zip(ys_p[:-1], ys_p[1:]):
            pillars.add((x_row, (a + b) / 2, top + beam / 2), (0.0, 0.0, 0.5 * math.pi), (b - a - 0.012, PILLAR_SIDE, beam),
                        rng.randrange(2), rng.random(), 0.0)
    pillars.emit("Khufu's mortuary temple pillars", battered_variants(lib, "granite masonry", mats["granite masonry"], **DRESSED_BLOCK),
                 coll, log)
    ax0, ax1, ay0, ay1 = inner[0] - PILLAR_SIDE / 2, inner[1] + PILLAR_SIDE / 2, inner[2] - PILLAR_SIDE / 2, inner[3] + PILLAR_SIDE / 2
    slab = 0.8
    rz = top + beam + slab / 2
    px0, px1, py0, py1 = min(xs), max(xs), min(ys), max(ys)
    for (cx, cy, sx, sy) in (((px0 + px1) / 2, (py0 + ay0 + PILLAR_SIDE) / 2, px1 - px0, ay0 + PILLAR_SIDE - py0),
                             ((px0 + px1) / 2, (ay1 - PILLAR_SIDE + py1) / 2, px1 - px0, py1 - ay1 + PILLAR_SIDE),
                             ((px0 + ax0 + PILLAR_SIDE) / 2, (ay0 + ay1) / 2, ax0 + PILLAR_SIDE - px0, ay1 - ay0),
                             ((ax1 - PILLAR_SIDE + px1) / 2, (ay0 + ay1) / 2, px1 - ax1 + PILLAR_SIDE, ay1 - ay0)):
        _box("Khufu's mortuary temple roof", (cx, cy, rz), (sx, sy, slab), mats["limestone roof"], coll)
    log(f"Khufu's mortuary temple: {laid} wall blocks and a roofed colonnade round the basalt court")


def _box(name, centre, size, mat, coll):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = centre
    ob.scale = size
    bev = ob.modifiers.new("arris", "BEVEL")
    bev.width = 0.03
    return ob
