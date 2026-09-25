"""
The harbour in front of the valley temples as built: a quay of dressed limestone along
the basin's west edge, and boats on the inundation.

The quay stands on the easternmost of the valley temples' east faces (the old viewer's
stage 7 found the westernmost runs a wall through Khafre's valley temple). Its line,
height and the boats are look choices; so is everything about the boats' form, after
the Old Kingdom's timber hulls with raised papyriform ends, a deck cabin, and a mast
with its sail furled.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import data, states
from .instancing import Field
from .variants import N_DRESSED
from .walls import simplify

QUAY_TOP_ABOVE_WATER = 1.2
BOATS = [  # (x, y, heading degrees from east, length m)
    (452.0, -468.0, 95.0, 24.0), (470.0, -505.0, 80.0, 18.0), (438.0, -540.0, 110.0, 30.0),
    (505.0, -455.0, 60.0, 16.0), (520.0, -520.0, 100.0, 22.0), (480.0, -575.0, 88.0, 14.0),
]


def _east_edge():
    xs = []
    for f in data.FOOTPRINTS:
        if f["id"] in ("khafre.valley_temple", "sphinx.temple"):
            xs.append(max(p[0] for p in simplify(f["ring"])))
    return max(xs) + 1.5


def _boat(length, rng):
    """A timber hull with raised ends, a cabin and a mast, as one mesh with three materials."""
    bm = bmesh.new()
    n = 24
    beam = length * 0.18
    depth = length * 0.07
    rings = []
    for i in range(n + 1):
        t = i / n
        x = (t - 0.5) * length
        w = beam * math.sin(math.pi * t) ** 0.65 * 0.5
        sheer = depth * (0.6 + 2.2 * abs(2 * t - 1) ** 3)       # the ends rise
        keel = -depth * 0.7 * math.sin(math.pi * t) ** 0.5
        ring = [bm.verts.new((x, -w, sheer)), bm.verts.new((x, -w * 0.8, keel * 0.6)), bm.verts.new((x, 0.0, keel)),
                bm.verts.new((x, w * 0.8, keel * 0.6)), bm.verts.new((x, w, sheer))]
        rings.append(ring)
    for i in range(n):
        for j in range(4):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
    # Deck.
    for i in range(n):
        try:
            bm.faces.new((rings[i][0], rings[i][4], rings[i + 1][4], rings[i + 1][0]))
        except ValueError:
            pass
    hull_faces = len(bm.faces)
    # Cabin amidships, a little aft.
    cab = bmesh.ops.create_cube(bm, size=1.0)
    for v in cab["verts"]:
        v.co = Vector((v.co.x * length * 0.22 - length * 0.08, v.co.y * beam * 0.6, v.co.z * depth * 1.4 + depth * 1.3))
    cabin_faces = len(bm.faces)
    # Mast and yard with the sail furled on it.
    mast = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.12, radius2=0.08, depth=length * 0.45)
    for v in mast["verts"]:
        v.co += Vector((length * 0.08, 0.0, depth + length * 0.225))
    yard = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.35, radius2=0.35, depth=length * 0.32)
    for v in yard["verts"]:
        v.co = Vector((length * 0.08, v.co.z, v.co.x + depth + length * 0.42))
    me = bpy.data.meshes.new("boat")
    bm.to_mesh(me)
    bm.free()
    for k, poly in enumerate(me.polygons):
        poly.material_index = 0 if k < hull_faces else (1 if k < cabin_faces else 2)
    me.shade_smooth()
    return me


def boat_materials():
    def principled(name, rgb, rough):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        b = mat.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = rgb
        b.inputs["Roughness"].default_value = rough
        return mat
    return (principled("boat hull", (0.19, 0.11, 0.06, 1.0), 0.6), principled("boat cabin", (0.62, 0.52, 0.36, 1.0), 0.8),
            principled("boat mast and sail", (0.78, 0.72, 0.6, 1.0), 0.85))


def build(state, rng, terrain, coll, mats, lib, log=print):
    if states.spec(state)["water"] != "harbour":
        return
    from .water import LEVELS
    water_z = LEVELS["harbour"][0]
    x = _east_edge()
    y0, y1 = -545.0, -400.0
    # The quay: dressed courses from below the water up past it, a stretch at a time along the basin's edge.
    blocks = Field()
    course = 0.9
    top = water_z + QUAY_TOP_ABOVE_WATER
    base = water_z - 2.0
    n = int(round((top - base) / course))
    yy = y0
    while yy < y1:
        bl = rng.uniform(1.4, 2.4)
        for k in range(n):
            blocks.add((x + 1.5, yy + bl / 2, base + k * course + course / 2), (0.0, 0.0, -0.5 * math.pi),
                       (bl - 0.03, 3.0, course - 0.03), rng.randrange(N_DRESSED), rng.random(), rng.random() * 0.1)
        yy += bl
    blocks.emit("quay", lib["dressed limestone"], coll, log)
    hull, cabin, rig = boat_materials()
    for bx, by, heading, length in BOATS:
        me = _boat(length, rng)
        for m in (hull, cabin, rig):
            me.materials.append(m)
        ob = bpy.data.objects.new("boat", me)
        coll.objects.link(ob)
        ob.location = (bx, by, water_z + 0.05)
        ob.rotation_euler = (0.0, 0.0, math.radians(heading))
    log(f"harbour: quay at x {x:.0f} from y {y0:.0f} to {y1:.0f}, {len(BOATS)} boats")
