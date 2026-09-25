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

from . import data, states
from .instancing import Field
from .nodes import Tree, hexlin
from .variants import N_DRESSED
from .walls import lay_ring

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
    mat = bpy.data.materials.new("basalt")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Position"], sep.inputs[0])
    uv = t.node("ShaderNodeCombineXYZ")
    t.link(sep.outputs["X"], uv.inputs[0])
    t.link(sep.outputs["Y"], uv.inputs[1])
    br = t.node("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.012
    br.inputs["Brick Width"].default_value = 1.3
    br.inputs["Row Height"].default_value = 0.9
    t.link(uv.outputs[0], br.inputs["Vector"])
    base = t.ramp(t.noise(geo.outputs["Position"], 0.6, 4.0), [(0.3, hexlin("2a2826")), (0.7, hexlin("3a3632"))])
    col = t.mix(t.math("MULTIPLY", br.outputs["Fac"], 0.5), base, hexlin("6b6358"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
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
    walls = Field()
    laid = lay_ring(ring, z + thick, HEIGHT, rng, walls, course=1.0, length=2.0, depth=WALL, batter_deg=84.0, miss=0.0,
                    variants=N_DRESSED, openings=[(x1, 0.0, 4.0, 5.0), (x0, 0.0, 6.0, 6.0)], joint=0.02, erosion_jitter=False)
    walls.emit("Khufu's mortuary temple walls", lib["dressed limestone"], coll, log)
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
                        rng.randrange(N_DRESSED), rng.random(), 0.0)
    pillars.emit("Khufu's mortuary temple pillars", lib["dressed granite"], coll, log)
    log(f"Khufu's mortuary temple: {laid} wall blocks and a colonnade on the basalt court")
