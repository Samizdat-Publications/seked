"""
Inside Khafre's valley temple as built: the T-shaped hall of red granite.

Petrie measured the hall (1883, §96-97 and Pl. vi; data/measurements/giza-temples.json): a
transverse hall running north and south with a single colonnade of six pillars down it, and a
longitudinal hall running west from its middle with two colonnades of five, the easternmost two
58 in wide to carry three beams each; pillars and beams monoliths of red granite; the single
colonnade 222.4 in high; slits along the top of the western walls, 41 in long, letting in light
reflected down shafts that rise to the court on the roof. Where the hall stands in the temple is
Hölscher's (1912, Blatt XVII, registered onto the OSM footprint; data/measurements/
khafre-valley-temple.json): the west face of the long hall and its rows of pillars, and the rhythm
of the statue sockets along its walls. The two agree: Hölscher's hall runs 15.32 m to the west
face of the junction's pillar, Petrie's 16.78 m to the transverse hall, a 58 in pillar apart.

The rest is said to be a look choice where it is drawn: the alabaster floor (calcite paving was
found in the hall), the slits' height, the roof slabs, the light (the glow the shafts reflect down
each slit, and the daylight the vestibule sends along the passage east, are drawn as soft lamps
inside a shell that keeps the sun out, so the hall is lit as it was, by those alone), and the
statues: 23 stand-ins of a seated Khafre, fourteen on Hölscher's sockets along the long hall's
walls and nine along the transverse hall's (blender/models.json `props`, khafre-statue).

Only the as-built era has it. `build` makes it; `exterior` names the temple's objects that fill
the hall's space, which the scene hides while the camera stands inside.
"""
import math

import bmesh
import bpy

from . import data
from .interior import _box, _emit, masonry, room_frame
from .nodes import Tree, hexlin

TEMPLE = "khafre.valley_temple"
FLOOR_LIFT = 0.1          # the floor stands this far over the ground the footprint is registered to
WALL = 1.6                # look choice: how thick the hall's walls are drawn
ROOF = 1.1                # look choice: the roof slabs' depth
SLIT_HIGH = 0.13          # look choice: "a few inches wide"
PASSAGE = 4.1             # look choice: the passage east is drawn to the vestibule's west wall, 4.1 m on
STATUE_HEIGHT = 1.68      # the diorite Khafre in Cairo (JE 10062) is 168 cm high; every stand-in is drawn at it
SLIT_WATTS = 220.0        # look choice: the glow a shaft reflects down its slit
PASSAGE_WATTS = 500.0     # look choice: the daylight in the vestibule, falling on its east wall
VESTIBULE = 4.45          # look choice after Petrie's plan: the vestibule's depth east of the passage
DAYLIGHT = (1.0, 0.93, 0.82)
ERAS = ("built", "today")
# Petrie, §96: "Six of these beams, or a third of the whole, are now missing". Which six is a look choice.
MISSING = (1, 4, 8, 11, 15, 19)


def _r():
    r = {r["key"]: r["value"] for r in data.records("giza-temples.json")}
    r.update({r["key"]: r["value"] for r in data.records("khafre-valley-temple.json")})
    return r


def exterior():
    """The exterior's objects that would fill or darken the hall: its solid core, its roof slab, its dark doorway mouths."""
    names = [f"{TEMPLE} core", f"{TEMPLE} roof"]
    return names + [ob.name for ob in bpy.data.objects if ob.name.startswith("doorway")]


def plan():
    """
    The hall in the project frame: a dict of its lines (x east, y north, metres) and levels, the
    pillars as (x, y, side) and the slits as (x0, x1, y, side of the wall they open from).
    """
    from .temples import centroid
    r = _r()
    f = next(f for f in data.FOOTPRINTS if f["id"] == TEMPLE)
    cx, cy = centroid(f["ring"])                             # the point Hölscher's plate is registered to
    y_mid = cy + r["khafre_valley_temple.hall.pillar.row.north"] - r["khafre_valley_temple.pillar.pitch.north"] / 2
    long_len = (r["khafre.valley.hall.long.length.north"] + r["khafre.valley.hall.long.length.south"]) / 2
    trans_w = (r["khafre.valley.hall.transverse.width.west_band"] + r["khafre.valley.hall.transverse.width.row"]
               + r["khafre.valley.hall.transverse.width.east_band"])
    x_lw = cx + r["khafre_valley_temple.hall.stem.west"]
    x_w = x_lw + long_len
    x_e = x_w + trans_w
    trans_len = (r["khafre.valley.hall.transverse.length.west"] + r["khafre.valley.hall.transverse.length.east"]) / 2
    y_s, y_n = y_mid - trans_len / 2, y_mid + trans_len / 2
    aisles = [r["khafre.valley.hall.long.aisle.south"], r["khafre.valley.hall.long.aisle.middle"],
              r["khafre.valley.hall.long.aisle.north"]]
    side = r["khafre.valley.pillar.side"]
    big = r["khafre.valley.pillar.large.side"]
    long_w = sum(aisles) + 2 * side
    y_ls, y_ln = y_mid - long_w / 2, y_mid + long_w / 2
    pillars = []
    # The single colonnade: six pillars down the transverse hall at the mean gap, the ends taking up the rest.
    x_row = x_w + r["khafre.valley.hall.transverse.width.west_band"] + r["khafre.valley.hall.transverse.width.row"] / 2
    gap = r["khafre.valley.hall.transverse.row.gap"]
    run = 6 * side + 5 * gap
    first = y_mid - run / 2 + side / 2
    for k in range(6):
        pillars.append((x_row, first + k * (side + gap), side))
    # The double colonnade: two rows of four at the mean gap from the west wall, then the large pillar at the junction.
    row_y = [y_ls + aisles[0] + side / 2, y_ls + aisles[0] + side + aisles[1] + side / 2]
    lgap = r["khafre.valley.hall.long.row.gap"]
    long_xs = [x_lw + lgap + side / 2 + k * (side + lgap) for k in range(4)]
    x_big = x_w - big / 2
    for y in row_y:
        pillars += [(x, y, side) for x in long_xs]
        pillars.append((x_big, y, big))
    # The slits, over the bays between the pillars along the long hall's walls.
    edges = [x_lw] + long_xs + [x_big]
    slit = r["khafre.valley.slit.length"]
    slits = []
    for a, b in zip(edges[:-1], edges[1:]):
        c = (a + b) / 2
        slits += [(c - slit / 2, c + slit / 2, y_ls, -1), (c - slit / 2, c + slit / 2, y_ln, 1)]
    sockets = [cx + r["khafre_valley_temple.hall.socket.first.east"] + k * r["khafre_valley_temple.hall.socket.pitch"]
               for k in range(7)]
    floor = f["base"] + FLOOR_LIFT
    return dict(x_lw=x_lw, x_w=x_w, x_e=x_e, x_row=x_row, y_mid=y_mid, y_s=y_s, y_n=y_n, y_ls=y_ls, y_ln=y_ln,
                row_y=row_y, x_big=x_big, pillars=pillars, slits=slits, sockets=sockets, floor=floor, base=f["base"],
                pillar_h=r["khafre.valley.pillar.height"], single=r["khafre.valley.beam.single.depth"],
                double=r["khafre.valley.beam.double.depth"], ceiling_t=r["khafre.valley.colonnade.height"],
                ceiling_l=r["khafre.valley.pillar.height"] + r["khafre.valley.beam.double.depth"],
                passage_w=r["khafre.valley.hall.transverse.passage.width"], side=side, big=big)


def alabaster_material(name="alabaster floor", worn=False):
    """Egyptian alabaster (calcite) paving: honey-white, banded, in large slabs (look choice); polished as built, dulled and dusty today."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    bands = t.node("ShaderNodeMapping")
    bands.inputs["Scale"].default_value = (0.35, 1.6, 1.0)
    t.link(geo.outputs["Position"], bands.inputs["Vector"])
    # Soft cloudy banding, as calcite runs, and a few darker veins through it.
    cloud = t.noise(bands.outputs[0], 2.2, 6.0, 0.6)
    col = t.ramp(cloud, [(0.3, hexlin("dccbad")), (0.5, hexlin("e9dcc3")), (0.7, hexlin("f1e7d5"))])
    vein = t.band(t.noise(geo.outputs["Position"], 1.1, 8.0, 0.7), 0.52, 0.5)
    col = t.mix(t.math("MULTIPLY", vein, 0.35), col, hexlin("b89f7a"))
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Position"], sep.inputs[0])
    uv = t.node("ShaderNodeCombineXYZ")
    t.link(sep.outputs[0], uv.inputs[0])
    t.link(sep.outputs[1], uv.inputs[1])
    slabs = t.node("ShaderNodeTexBrick")
    slabs.offset = 0.5
    slabs.inputs["Scale"].default_value = 1.0
    slabs.inputs["Brick Width"].default_value = 1.9
    slabs.inputs["Row Height"].default_value = 1.2
    slabs.inputs["Mortar Size"].default_value = 0.006
    slabs.inputs["Color1"].default_value = (1.0, 1.0, 1.0, 1.0)
    slabs.inputs["Color2"].default_value = (0.9, 0.9, 0.9, 1.0)
    t.link(uv.outputs[0], slabs.inputs["Vector"])
    col = t.mix(1.0, col, slabs.outputs["Color"], "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", slabs.outputs["Fac"], 0.6), col, hexlin("8a7a62"))
    if worn:
        dust = t.band(t.noise(geo.outputs["Position"], 0.5, 4.0), 0.35, 0.75)
        col = t.mix(t.math("MULTIPLY", dust, 0.55), col, hexlin("b9a07c"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55 if worn else 0.18
    return mat


def beams(p):
    """
    The hall's beams one by one, each as (from, to, the axis it runs along, the line it lies on, depth):
    the single colonnade's seven spans from wall to wall, the double's five a row from the west wall to
    the large pillar, and the three across the long hall's mouth.
    """
    side, big = p["side"], p["big"]
    out = []
    ys = [p["y_s"]] + sorted(y for x, y, s in p["pillars"] if abs(x - p["x_row"]) < 0.01) + [p["y_n"]]
    for a, b in zip(ys[:-1], ys[1:]):
        out.append((a if a == p["y_s"] else a - side / 2, b if b == p["y_n"] else b + side / 2, "y", p["x_row"], p["single"]))
    for y in p["row_y"]:
        xs = [p["x_lw"]] + sorted(x for x, yy, s in p["pillars"] if abs(yy - y) < 0.01 and x < p["x_w"])
        for a, b in zip(xs[:-1], xs[1:]):
            out.append((a if a == p["x_lw"] else a - side / 2, b + (big if b == p["x_big"] else side) / 2, "x", y, p["double"]))
    mouth = [p["y_ls"]] + sorted(p["row_y"]) + [p["y_ln"]]
    for a, b in zip(mouth[:-1], mouth[1:]):
        out.append((a if a == p["y_ls"] else a - big / 2, b if b == p["y_ln"] else b + big / 2, "y", p["x_big"], p["single"]))
    return out


def _wall_run(bm, x0, x1, y0, y1, z0, z1, gaps=()):
    """A wall box along x from x0 to x1, leaving (a, b, z_top) notches at its top where the slits are."""
    pos = x0
    for a, b, z_top in sorted(g for g in gaps if x0 < g[0] < x1):
        if a > pos:
            _box(bm, pos, a, y0, y1, z0, z1)
        _box(bm, a, b, y0, y1, z0, z_top)
        pos = b
    if x1 > pos:
        _box(bm, pos, x1, y0, y1, z0, z1)


def _lamp(coll, name, loc, rot, size, size_y, watts):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size, light.size_y = size, size_y
    light.energy = watts
    light.color = DAYLIGHT
    ob = bpy.data.objects.new(name, light)
    ob.location = loc
    ob.rotation_euler = rot
    coll.objects.link(ob)
    return ob


def build(state, coll, mats, log=print):
    """
    The hall, its colonnades and slits: as built roofed, shut in its shell and lit by its lamps; today
    open to the sky and lit by the sun, a third of its beams gone. Returns the objects made.
    """
    if state not in ERAS:
        return []
    built = state == "built"
    p = plan()
    fz, t_ceil, l_ceil = p["floor"], p["floor"] + p["ceiling_t"], p["floor"] + p["ceiling_l"]
    granite = masonry("hall granite", ("6b4c44", "82605a"), 0.3, 1.18, 2.6, room_frame(fz), joint=0.7,
                      speckle="1c1715", mortar=0.006, quartz="8e8984")
    made = []
    x_lw, x_w, x_e, y_s, y_n, y_ls, y_ln = (p[k] for k in ("x_lw", "x_w", "x_e", "y_s", "y_n", "y_ls", "y_ln"))
    x_end = x_e + PASSAGE
    half_pass = p["passage_w"] / 2
    ym = p["y_mid"]
    # The floor under the whole T and the passage.
    bm = bmesh.new()
    _box(bm, x_lw - WALL, x_end + VESTIBULE + WALL, y_s - WALL, y_n + WALL, fz - 0.4, fz)
    made.append(_emit("valley temple floor", bm, alabaster_material(worn=not built), coll))
    # Walls. The long hall's north and south walls stop short of the ceiling where a slit opens.
    bm = bmesh.new()
    south_gaps = [(a, b, l_ceil - SLIT_HIGH) for a, b, y, s in p["slits"] if s < 0]
    north_gaps = [(a, b, l_ceil - SLIT_HIGH) for a, b, y, s in p["slits"] if s > 0]
    _wall_run(bm, x_lw, x_w, y_ls - WALL, y_ls, fz, l_ceil, south_gaps)                      # long hall, south
    _wall_run(bm, x_lw, x_w, y_ln, y_ln + WALL, fz, l_ceil, north_gaps)                      # long hall, north
    _box(bm, x_lw - WALL, x_lw, y_ls - WALL, y_ln + WALL, fz, l_ceil)                          # long hall, west end
    _box(bm, x_w - WALL, x_w, y_s - WALL, y_ls, fz, t_ceil)                                    # transverse, west, south part
    _box(bm, x_w - WALL, x_w, y_ln, y_n + WALL, fz, t_ceil)                                    # transverse, west, north part
    _box(bm, x_w - WALL, x_e + WALL, y_s - WALL, y_s, fz, t_ceil)                              # transverse, south end
    _box(bm, x_w - WALL, x_e + WALL, y_n, y_n + WALL, fz, t_ceil)                              # transverse, north end
    _box(bm, x_e, x_e + WALL, y_s, ym - half_pass, fz, t_ceil)                                 # transverse, east, south
    _box(bm, x_e, x_e + WALL, ym + half_pass, y_n, fz, t_ceil)                                 # transverse, east, north
    _box(bm, x_e, x_end, ym - half_pass - WALL, ym - half_pass, fz, t_ceil)                    # the passage's sides
    _box(bm, x_e, x_end, ym + half_pass, ym + half_pass + WALL, fz, t_ceil)
    # Beyond the passage, the vestibule's east wall (a stand-in for the room, lit by its two entrances).
    _box(bm, x_end, x_end + VESTIBULE, ym - half_pass - 2.0, ym - half_pass, fz, t_ceil)
    _box(bm, x_end, x_end + VESTIBULE, ym + half_pass, ym + half_pass + 2.0, fz, t_ceil)
    _box(bm, x_end + VESTIBULE, x_end + VESTIBULE + WALL, ym - half_pass - 2.0, ym + half_pass + 2.0, fz, t_ceil)
    if built:
        _box(bm, x_end, x_end + VESTIBULE, ym - half_pass - 2.0, ym + half_pass + 2.0, t_ceil, t_ceil + ROOF)
        # The ceilings: slabs over the transverse hall at the single colonnade's height, over the long hall at the double's.
        _box(bm, x_w, x_end, y_s, y_n, t_ceil, t_ceil + ROOF)
        _box(bm, x_lw, x_w, y_ls, y_ln, l_ceil, t_ceil + ROOF)
    made.append(_emit("valley temple walls", bm, granite, coll))
    # Pillars and beams, monoliths of the same granite.
    bm = bmesh.new()
    ph = fz + p["pillar_h"]
    for x, y, s in p["pillars"]:
        _box(bm, x - s / 2, x + s / 2, y - s / 2, y + s / 2, fz, ph)
    for k, (a, b, axis, fixed, depth) in enumerate(beams(p)):
        if not built and k in MISSING:
            continue
        half = p["side"] / 2
        if axis == "y":
            _box(bm, fixed - half, fixed + half, a, b, ph, ph + depth)
        else:
            _box(bm, a, b, fixed - half, fixed + half, ph, ph + depth)
    made.append(_emit("valley temple colonnades", bm, granite, coll))
    if not built:
        for ob in made:
            ob["seked"] = ("the granite hall of Khafre's valley temple as it is, after Petrie's plan and text and Hölscher's placing; "
                           "which six beams are missing is a look choice")
        log(f"valley temple: the T-shaped hall open to the sky, {len(p['pillars'])} pillars, {len(beams(p)) - len(MISSING)} beams")
        return made
    # A shell round everything, so that no sun or sky reaches the hall but by the lamps below.
    dark = mats.get("dark") or granite
    bm = bmesh.new()
    _box(bm, x_lw - WALL - 1.0, x_end + VESTIBULE + WALL + 1.0, y_s - WALL - 1.0, y_n + WALL + 1.0, fz - 1.0, t_ceil + ROOF + 1.0)
    for f in bm.faces:
        f.normal_flip()
    made.append(_emit("valley temple shell", bm, dark, coll))
    # The light: a soft glow in each slit, sloping down into the hall, and the daylight at the passage's far end.
    for k, (a, b, y, s) in enumerate(p["slits"]):
        # An area lamp shines along its -Z: turned about X it faces into the hall, 30 degrees down.
        rot = (math.radians(60.0 if s < 0 else -60.0), 0.0, 0.0)
        made.append(_lamp(coll, f"valley temple slit {k:02d}", ((a + b) / 2, y - s * 0.02, l_ceil - SLIT_HIGH / 2),
                          rot, b - a, SLIT_HIGH, SLIT_WATTS))
    # In the vestibule, turned about Y to face its east wall: the daylight of the entrances falling on it,
    # which the hall sees at the passage's end. Its size (local X) stands vertical, its size_y runs north and south.
    made.append(_lamp(coll, "valley temple vestibule light", (x_end + 0.4, ym, fz + p["ceiling_t"] * 0.6),
                      (0.0, math.radians(-90.0), 0.0), p["ceiling_t"] * 0.5, p["passage_w"] + 2.0, PASSAGE_WATTS))
    for ob in made:
        ob["seked"] = ("the granite hall of Khafre's valley temple, after Petrie's plan and text and Hölscher's placing; "
                       "the floor, the roof, the light and the statues are look choices")
    log(f"valley temple: the T-shaped hall, {len(p['pillars'])} pillars, {len(p['slits'])} slits lit, floor at {fz:.2f} m, "
        f"ceilings {p['ceiling_t']:.2f} and {p['ceiling_l']:.2f} m over it")
    return made


def statue_model(log=print):
    """
    The seated Khafre stand-in (blender/models.json `props`): one mesh facing +X, STATUE_HEIGHT high,
    the middle of its base at the origin, parked out of sight so only its copies render; None when
    it is not on disk (python scripts/models.py fetches it).
    """
    import io
    import json
    import os
    import sys

    import numpy as np
    from mathutils import Matrix

    index_path = os.path.join(data.REPO, "build", "models", "index.json")
    if not os.path.exists(index_path):
        return None
    index = json.load(io.open(index_path, encoding="utf-8"))
    entry = index.get("models", index).get("khafre-statue")
    path = os.path.join(data.REPO, "build", "models", entry["file"]) if entry else None
    if not path or not os.path.exists(path):
        log("valley temple: the Khafre statue is not on disk; no statues")
        return None
    blender_dir = os.path.join(data.REPO, "blender")
    if blender_dir not in sys.path:
        sys.path.insert(0, blender_dir)
    import render_standins as rs   # the old renderer's importer, which runs inside Blender

    obj = rs.cut_and_reduce(rs.import_model(path, "khafre statue", keep_materials=True), None, 120000, largest_only=True)
    me = obj.data

    def coords():
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        return co.reshape(-1, 3)

    co = coords()
    z0, z1 = float(co[:, 2].min()), float(co[:, 2].max())
    low = co[co[:, 2] < z0 + 0.1 * (z1 - z0)]
    xy = low[:, :2] - low[:, :2].mean(0)
    _, vecs = np.linalg.eigh(np.cov(xy.T))
    ax = vecs[:, 1]                     # the base's long side runs front to back
    me.transform(Matrix.Rotation(-math.atan2(ax[1], ax[0]), 4, "Z"))
    co = coords()
    head = co[co[:, 2] > z0 + 0.85 * (z1 - z0)]
    low = co[co[:, 2] < z0 + 0.1 * (z1 - z0)]
    if head[:, 0].mean() > low[:, 0].mean():      # the head sits over the throne's back: the front is away from it
        me.transform(Matrix.Rotation(math.pi, 4, "Z"))
        co = coords()
        low = co[co[:, 2] < z0 + 0.1 * (z1 - z0)]
    s = STATUE_HEIGHT / (z1 - z0)
    cx, cy = float(low[:, 0].mean()), float(low[:, 1].mean())
    me.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -z0)))
    me.update()
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    obj["seked"] = "stand-in: a scan of a seated Khafre in Cairo, drawn at 1.68 m; nothing of its form is a measurement"
    log(f"valley temple: Khafre statue, {len(me.polygons):,} faces, {STATUE_HEIGHT} m high")
    return obj


def statues(state, coll, log=print):
    """The 23 statues along the hall's walls, as copies of the one stand-in; returns them."""
    if state != "built":
        return []
    model = statue_model(log)
    if model is None:
        return []
    p = plan()
    made = []
    for k, (x, y, facing) in enumerate(statue_spots(p)):
        ob = bpy.data.objects.new(f"khafre statue {k:02d}", model.data)
        coll.objects.link(ob)
        ob.location = (x, y, p["floor"])
        ob.rotation_euler = (0.0, 0.0, math.radians(facing))
        ob["seked"] = model["seked"]
        made.append(ob)
    log(f"valley temple: {len(made)} statues along the walls")
    return made


def statue_spots(p=None):
    """
    Where the 23 statues stand, as (x, y, facing degrees from east): fourteen on Hölscher's socket
    rhythm along the long hall's north and south walls, facing across it, and nine along the
    transverse hall's walls (look choice), facing into it.
    """
    p = p or plan()
    spots = []
    off = 0.55
    for x in p["sockets"]:
        spots.append((x, p["y_ls"] + off, 90.0))
        spots.append((x, p["y_ln"] - off, -90.0))
    ym, half_pass = p["y_mid"], p["passage_w"] / 2
    for a, b in ((p["y_s"] + 1.6, ym - half_pass - 1.0), (ym + half_pass + 1.0, p["y_n"] - 1.6)):
        for k in range(2):
            spots.append((p["x_e"] - off, a + (b - a) * k, 180.0))              # the east wall, either side of the passage
    for a, b in ((p["y_s"] + 1.6, p["y_ls"] - 1.2), (p["y_ln"] + 1.2, p["y_n"] - 1.6)):
        for k in range(2):
            spots.append((p["x_w"] + off, a + (b - a) * k, 0.0))                # the west wall, either side of the long hall
    spots.append(((p["x_w"] + p["x_e"]) / 2, p["y_n"] - off, -90.0))           # the north end
    return spots
