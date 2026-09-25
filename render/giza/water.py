"""
Open water by era. The Nile runs about eight kilometres east of the plateau in every
era (its surface in GLO-30 sits near -46.5 m in this frame, stage 6's reading). As
built, the inundation fills the valley in front of the valley temples to a harbour
(its level a look choice, kept below the temples' platforms); in the claim's green
eras the flood plain reaches the plateau's foot. Where the ground stands above a
plane, the ground hides it, so each shoreline is the terrain's own.
"""
import bpy

from . import states

NILE = (-46.2, (5200.0, 11500.0, -11500.0, 11500.0))
LEVELS = {"harbour": (-43.3, (416.0, 2600.0, -1800.0, 1200.0)),
          "flood": (-42.6, (416.0, 11500.0, -11500.0, 11500.0))}


def _plane(name, z, box, coll, material):
    x0, x1, y0, y1 = box
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def build(state, coll, mats, log=print):
    kind = states.spec(state)["water"]
    _plane("the Nile", NILE[0], NILE[1], coll, mats["water"])
    if kind:
        z, box = LEVELS[kind]
        _plane(kind, z, box, coll, mats["water"])
        log(f"water: {kind} at {z} m and the Nile")
    else:
        log("water: the Nile")
