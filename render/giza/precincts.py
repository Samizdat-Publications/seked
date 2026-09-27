"""
The pyramids' precincts in the eras when they stood whole: a paved court round each
pyramid inside an enclosure wall, opened on the east where the mortuary temple joins it.

Khufu's inner enclosure wall stood about 10 m off his base (Lehner, The Complete
Pyramids); Khafre's and Menkaure's are drawn the same way at 10 and 8 m, which is a
look choice, as are the wall's height and thickness. (Petrie's peribolus of the
Second Pyramid, data/measurements/enclosures.json, is the great outer wall on its west
and north, 129.7 m out; a ring that far would run through Khufu, so it is not drawn
as one.) The court is paved in white limestone slabs; the wall is laid in dressed
limestone courses with a rounded capping.
"""
import math

import bpy

from . import data, materials, states
from .instancing import Field
from .variants import N_DRESSED
from .walls import battered_variants, lay_masonry, lay_ring

# pyramid: (distance of the wall's inner face from the base, thickness, height, east opening half-width)
WALLS = {"g1": (10.2, 3.2, 8.0, 25.0), "g2": (10.0, 3.2, 8.0, 24.0), "g3": (8.0, 2.6, 6.5, 27.0)}
COURSE = 1.0


def _pavement(P, reach, coll, material):
    """The court: a slab over the square from the pyramid's foot out to the wall."""
    cx, cy, h, z = P["cx"], P["cy"], P["half"] + reach, P["base"] + 0.03
    me = bpy.data.meshes.new(P["name"] + " court")
    me.from_pydata([(cx - h, cy - h, z), (cx + h, cy - h, z), (cx + h, cy + h, z), (cx - h, cy + h, z),
                    (cx - h, cy - h, z - 0.6), (cx + h, cy - h, z - 0.6), (cx + h, cy + h, z - 0.6), (cx - h, cy + h, z - 0.6)],
                   [], [(0, 1, 2, 3), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
    me.materials.append(material)
    ob = bpy.data.objects.new(P["name"] + " court", me)
    coll.objects.link(ob)
    return ob


def footprints(state):
    """The walled squares, so the terrain can level the courts: (cx, cy, half, base)."""
    if states.spec(state)["pyramids"] not in ("dressed", "pristine", "weathered"):
        return []
    out = []
    for key, (reach, thick, _, _) in WALLS.items():
        P = data.PYRAMIDS[key]
        out.append((P["cx"], P["cy"], P["half"] + reach + thick + 1.0, P["base"]))
    return out


def build(state, rng, coll, mats, lib, log=print):
    from .temples import DRESSED_BLOCK
    S = states.spec(state)
    if S["pyramids"] not in ("dressed", "pristine", "weathered"):
        return
    blocks = Field()
    built = state == "built"
    if built:
        # as built the courts are dusty and the walls laid in the temples' dressed limestone (look choices)
        materials.masonry_set(mats)
        if "court" not in mats:
            mats["court"] = materials.pavement("court", dusty=True)
    for key, (reach, thick, height, open_half) in WALLS.items():
        P = data.PYRAMIDS[key]
        _pavement(P, reach, coll, mats["court"] if built else mats["pavement"])
        h = P["half"] + reach + thick       # the wall's outer face
        ring = [(P["cx"] - h, P["cy"] - h), (P["cx"] + h, P["cy"] - h), (P["cx"] + h, P["cy"] + h), (P["cx"] - h, P["cy"] + h)]
        # The mortuary temple meets the wall on the east: leave it open there, full height.
        opening = [(P["cx"] + h, P["cy"], open_half * 2.0, height + 1.0)]
        if built:
            laid = lay_masonry(ring, P["base"], height, rng, blocks, course=COURSE, block=2.2, depth=thick, batter_deg=86.0,
                               openings=opening, joint=0.012, course_spread=0.25, block_spread=0.45, min_len=0.8, max_course=1.9)
        elif state in ("first-time", "lion"):
            # The claim's builders laid in megaliths, as its temples are (critic round 16: at the foot of the
            # pyramid a ring of 1 x 2 m blocks read as "a garden wall of cinder blocks" and shrank it). A look choice.
            laid = lay_masonry(ring, P["base"], height, rng, blocks, course=1.6, block=4.0, depth=thick, batter_deg=86.0,
                               openings=opening, joint=0.008, course_spread=0.3, block_spread=0.5, min_len=1.5, max_course=2.8)
        else:
            laid = lay_ring(ring, P["base"], height, rng, blocks, course=COURSE, length=2.0, depth=thick, batter_deg=86.0,
                            miss=0.0, variants=N_DRESSED, openings=opening, joint=0.02, erosion_jitter=False)
        log(f"{P['name']}: court and enclosure wall, {laid} blocks")
    if built:
        blocks.emit("enclosure walls", battered_variants(lib, "limestone masonry", mats["limestone masonry"], **DRESSED_BLOCK), coll, log)
    elif state in ("first-time", "lion"):
        worn = state == "lion"
        blocks.emit("enclosure walls", battered_variants(lib, "claim masonry", mats["limestone blocks worn" if worn else "limestone blocks"],
                                                         rounding=0.06 if worn else 0.008, erosion=0.03 if worn else 0.001,
                                                         chips=2 if worn else 0, cuts=4 if worn else 2, smooth=worn), coll, log)
    else:
        blocks.emit("enclosure walls", lib["dressed limestone"], coll, log)
