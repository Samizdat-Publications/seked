"""
Inside the Great Pyramid: the Grand Gallery, the King's Chamber and the Queen's Chamber,
from Petrie's interior survey (data/measurements/g1-interior.json and g1.json, all in the
project frame: metres east of Khufu's axis, north of it, and up from his base).

The gallery rises from its foot at the top of the ascending passage to the great step at
26.28 degrees; on each side a ramp, a vertical wall, then seven corbelled courses each
0.851 m high stepping in 0.069 m, under a roof as wide as the floor. The ramps carry
their slots in pairs. The King's Chamber is lined with red granite and roofed with nine
granite beams; the lidless coffer stands at its west end where Petrie found it (§58).

The light is the era's: electric strips along the ramps and at the chamber's walls
today; oil lamps in every earlier era. The ramps' height, the slots' count and size, the
step's width, the chamber's course height, the shafts' mouths and the modern walkway are
look choices where the tables are silent.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import data
from .nodes import Tree, hexlin

RAMP_HEIGHT = 0.6          # look choices where Petrie's tables are silent
SLOTS = 27
KC_COURSES = 5
PASSAGE_HEIGHT = 1.1       # the low passage from the step towards the antechamber
MODERN = ("today",)


def exposure(state):
    """The film exposure an inside view takes: electric light is brighter than a few oil lamps."""
    return 0.9 if state in MODERN else 1.8


def _r():
    """The interior records, with g1.json's chamber means and shaft outlets beside them."""
    r = {rec["key"]: rec["value"] for rec in data.records("g1.json")}
    r.update({rec["key"]: rec["value"] for rec in data.records("g1-interior.json")})
    return r


def _gallery_frame(r):
    """The gallery's foot on its axis and its virtual south end, and the slope between them."""
    angle = math.radians(r["gg.angle"])
    length = r["gg.length"]
    y_top, z_top = r["gg.floor.virtual_south_end.north"], r["gg.floor.virtual_south_end.up"]
    y_foot = y_top + length * math.cos(angle)
    z_foot = z_top - length * math.sin(angle)
    return angle, length, y_foot, z_foot, y_top, z_top


def floor_z(r, y):
    angle, _, y_foot, z_foot, _, _ = _gallery_frame(r)
    return z_foot + (y_foot - y) * math.tan(angle)


def masonry(name, colours, rough, course, width, frame, soot=0.0, height=6.0, joint=0.35, speckle=None, mortar=0.004,
            quartz="7f7a75"):
    """
    Fine stone laid in courses, the joints drawn as hairlines. `frame(t, geo)` returns the
    (along, up, height-above-floor) sockets the courses are laid in, so the same material
    serves the sloping gallery and the level chamber. Soot darkens it towards the roof.
    With `speckle` (the mica's colour) it is granite, its crystals feldspar in the two
    `colours`, `quartz` and mica.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    u, v, up = frame(t, geo)
    uv = t.node("ShaderNodeCombineXYZ")
    t.link(u, uv.inputs[0])
    t.link(v, uv.inputs[1])
    br = t.node("ShaderNodeTexBrick")
    br.offset = 0.5
    br.offset_frequency = 2
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Mortar Smooth"].default_value = 0.4
    br.inputs["Brick Width"].default_value = width
    br.inputs["Row Height"].default_value = course
    br.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)
    br.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1.0)
    t.link(uv.outputs[0], br.inputs["Vector"])
    tone = t.node("ShaderNodeRGBToBW")
    t.link(br.outputs["Color"], tone.inputs[0])
    col = t.ramp(t.noise(geo.outputs["Position"], 1.8, 5.0), [(0.3, hexlin(colours[0])), (0.7, hexlin(colours[1]))])
    col = t.mix(1.0, col, t.grey(t.math("ADD", t.math("MULTIPLY", tone.outputs[0], 0.14), 0.93)), "MULTIPLY")
    if speckle:        # granite: a mosaic of crystals a centimetre or two across, feldspar, quartz and mica
        # Aswan's crystals are large, a centimetre to three, and read across the chamber: big
        # feldspars over a finer ground of quartz and mica (critic round 13: "plaster").
        vor = t.node("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 45.0
        t.link(geo.outputs["Position"], vor.inputs["Vector"])
        cell = t.node("ShaderNodeSeparateColor")
        t.link(vor.outputs["Color"], cell.inputs[0])
        crystal = t.ramp(cell.outputs[0], [(0.0, hexlin(colours[1])), (0.45, hexlin(colours[0])), (0.7, hexlin(quartz)),
                                           (0.88, hexlin(speckle))], interp="CONSTANT")
        fine = t.node("ShaderNodeTexVoronoi")
        fine.inputs["Scale"].default_value = 160.0
        t.link(geo.outputs["Position"], fine.inputs["Vector"])
        fcell = t.node("ShaderNodeSeparateColor")
        t.link(fine.outputs["Color"], fcell.inputs[0])
        mica = t.math("GREATER_THAN", fcell.outputs[0], 0.86)
        col = t.mix(0.5, col, crystal)
        col = t.mix(t.math("MULTIPLY", mica, 0.6), col, hexlin(speckle))
    if soot:
        grime = t.math("MULTIPLY", t.band(up, 0.0, height), soot)
        grime = t.math("MULTIPLY", grime, t.band(t.noise(geo.outputs["Position"], 0.7, 3.0), 0.25, 0.75))
        col = t.mix(grime, col, hexlin("2e2620"))
    col = t.mix(t.math("MULTIPLY", br.outputs["Fac"], joint), col, hexlin("3a322a"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def gallery_frame(r):
    """Courses that run parallel to the gallery floor, their joints on the corbels' lines."""
    angle, _, y_foot, z_foot, _, _ = _gallery_frame(r)
    ch, n = r["gg.corbel.height"], int(r["gg.corbel.count"])
    offset = (r["gg.height"] - n * ch) % ch

    def frame(t, geo):
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Position"], sep.inputs[0])
        nrm = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Normal"], nrm.inputs[0])
        rise = t.math("MULTIPLY", t.math("SUBTRACT", y_foot, sep.outputs["Y"]), math.tan(angle))
        along = t.math("DIVIDE", t.math("SUBTRACT", y_foot, sep.outputs["Y"]), math.cos(angle))
        up = t.math("SUBTRACT", sep.outputs["Z"], t.math("ADD", rise, z_foot))
        flat = t.math("GREATER_THAN", t.math("ABSOLUTE", nrm.outputs["Z"]), 0.5)
        side = t.math("GREATER_THAN", t.math("ABSOLUTE", nrm.outputs["X"]), t.math("ABSOLUTE", nrm.outputs["Y"]))
        wall_u = t.math("ADD", t.math("MULTIPLY", side, along), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, side), sep.outputs["X"]))
        u = t.math("ADD", t.math("MULTIPLY", flat, along), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, flat), wall_u))
        v = t.math("ADD", t.math("MULTIPLY", flat, t.math("MULTIPLY", sep.outputs["X"], 1.7)),
                   t.math("MULTIPLY", t.math("SUBTRACT", 1.0, flat), t.math("SUBTRACT", up, offset)))
        return u, v, up
    return frame


def room_frame(z0):
    """Level courses from the chamber floor; floor slabs and ceiling beams laid east to west."""
    def frame(t, geo):
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Position"], sep.inputs[0])
        nrm = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Normal"], nrm.inputs[0])
        up = t.math("SUBTRACT", sep.outputs["Z"], z0)
        flat = t.math("GREATER_THAN", t.math("ABSOLUTE", nrm.outputs["Z"]), 0.5)
        side = t.math("GREATER_THAN", t.math("ABSOLUTE", nrm.outputs["X"]), t.math("ABSOLUTE", nrm.outputs["Y"]))
        wall_u = t.math("ADD", t.math("MULTIPLY", side, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, side), sep.outputs["X"]))
        u = t.math("ADD", t.math("MULTIPLY", flat, sep.outputs["X"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, flat), wall_u))
        v = t.math("ADD", t.math("MULTIPLY", flat, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, flat), up))
        return u, v, up
    return frame


def _box(bm, x0, x1, y0, y1, z0, z1):
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                    (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])


def _slope_quad(bm, r, x0, x1, ya, yb, lift):
    """A quad lying on the gallery's slope between ya and yb, `lift` above the floor line."""
    bm.faces.new([bm.verts.new((x, y, floor_z(r, y) + lift)) for x, y in ((x0, ya), (x1, ya), (x1, yb), (x0, yb))])


def _slope_box(bm, r, x0, x1, ya, yb, lift0, lift1):
    """A box following the slope: its top and bottom parallel to the gallery floor."""
    p = [(x0, ya, lift0), (x1, ya, lift0), (x1, yb, lift0), (x0, yb, lift0),
         (x0, ya, lift1), (x1, ya, lift1), (x1, yb, lift1), (x0, yb, lift1)]
    v = [bm.verts.new((x, y, floor_z(r, y) + h)) for x, y, h in p]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in f])


def _emit(name, bm, material, coll):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def section(r):
    """The gallery's cross-section as (across, up from the floor line), walked round from the left floor edge."""
    floor_w, ramp_w = r["gg.floor.width"], r["gg.ramp.width"]
    ch, over, n = r["gg.corbel.height"], r["gg.corbel.overlap"], int(r["gg.corbel.count"])
    wall_h = r["gg.height"] - n * ch
    half = floor_w / 2 + ramp_w
    left = [(-floor_w / 2, 0.0), (-floor_w / 2, RAMP_HEIGHT), (-half, RAMP_HEIGHT), (-half, wall_h)]
    for k in range(n):
        w = half - (k + 1) * over
        left += [(-w, wall_h + k * ch), (-w, wall_h + (k + 1) * ch)]
    right = [(-a, b) for a, b in reversed(left)]
    return left + right


def gallery(state, coll, mats, log=print):
    r = _r()
    angle, length, y_foot, z_foot, y_top, z_top = _gallery_frame(r)
    x = r["gg.floor.virtual_south_end.east"]
    floor_w, ramp_w = r["gg.floor.width"], r["gg.ramp.width"]
    half = floor_w / 2 + ramp_w
    sec = section(r)
    n = len(sec)
    step_y, step_z = r["gg.step.top.north"], r["gg.step.top.up"]
    bm = bmesh.new()
    # From the foot to the great step's face, the whole section: floor, ramps, walls, corbels, roof.
    steps = 44
    rings = []
    for i in range(steps + 1):
        y = y_foot + (step_y - y_foot) * i / steps
        z = floor_z(r, y)
        rings.append([bm.verts.new((x + a, y, z + b)) for a, b in sec])
    for i in range(steps):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    bm.faces.new(rings[0])                     # the north wall, over the ascending passage's mouth
    # Over the step to the south wall the floor is the step's top; the walls and corbels run on.
    upper = sec[3:n // 2]
    tail = []
    for y in (step_y, (step_y + y_top) / 2, y_top):
        z = floor_z(r, y)
        tail.append([bm.verts.new((x - half, y, step_z))] + [bm.verts.new((x + a, y, z + b)) for a, b in upper] +
                    [bm.verts.new((x - a, y, z + b)) for a, b in reversed(upper)] + [bm.verts.new((x + half, y, step_z))])
    for i in range(2):
        for j in range(len(tail[0]) - 1):
            bm.faces.new((tail[i][j], tail[i][j + 1], tail[i + 1][j + 1], tail[i + 1][j]))
    bm.faces.new(list(reversed(tail[-1])))     # the south wall, over the great step
    _emit("grand gallery", bm, mats["gallery stone"], coll)
    # The great step, its face on the pyramid's east-west axis, across the gallery's full width.
    bm = bmesh.new()
    _box(bm, x - half, x + half, y_top, step_y, floor_z(r, step_y) - 0.4, step_z)
    _emit("great step", bm, mats["gallery stone"], coll)
    # Dark mouths: the ascending passage below the north wall, the low passage above the step.
    bm = bmesh.new()
    rise = r["passage.ascending.height"] / math.cos(angle)
    bm.faces.new([bm.verts.new(p) for p in ((x - floor_w / 2, y_foot - 0.01, z_foot), (x + floor_w / 2, y_foot - 0.01, z_foot),
                                            (x + floor_w / 2, y_foot - 0.01, z_foot + rise), (x - floor_w / 2, y_foot - 0.01, z_foot + rise))])
    w = r["passage.ascending.width"] / 2
    bm.faces.new([bm.verts.new(p) for p in ((x - w, y_top + 0.01, step_z), (x - w, y_top + 0.01, step_z + PASSAGE_HEIGHT),
                                            (x + w, y_top + 0.01, step_z + PASSAGE_HEIGHT), (x + w, y_top + 0.01, step_z))])
    # The ramps' slots, in pairs, cut into the ramp tops.
    for k in range(SLOTS):
        yc = y_foot + (step_y - y_foot) * (k + 0.5) / SLOTS
        for side in (-1, 1):
            cx = x + side * (floor_w / 2 + ramp_w / 2)
            _slope_quad(bm, r, cx - 0.09, cx + 0.09, yc + 0.26, yc - 0.26, RAMP_HEIGHT + 0.004)
    _emit("gallery mouths and slots", bm, mats["dark"], coll)
    if state in MODERN:
        # The walkway: planks over the floor between the ramps with cleats for the feet, and a rail each side.
        bm = bmesh.new()
        _slope_box(bm, r, x - floor_w / 2 + 0.02, x + floor_w / 2 - 0.02, y_foot - 0.3, step_y + 0.05, 0.02, 0.08)
        y = y_foot - 0.5
        while y > step_y + 0.4:
            _slope_box(bm, r, x - floor_w / 2 + 0.05, x + floor_w / 2 - 0.05, y, y - 0.05, 0.08, 0.12)
            y -= 0.42
        _emit("walkway", bm, mats["timber"], coll)
        bm = bmesh.new()
        for side in (-1, 1):
            rx = x + side * (floor_w / 2 + 0.06)
            _slope_box(bm, r, rx - 0.025, rx + 0.025, y_foot - 0.5, step_y + 0.3, RAMP_HEIGHT + 0.88, RAMP_HEIGHT + 0.93)
            y = y_foot - 0.5
            while y > step_y + 0.3:
                _slope_box(bm, r, rx - 0.02, rx + 0.02, y, y - 0.04, RAMP_HEIGHT, RAMP_HEIGHT + 0.9)
                y -= 3.0
        _emit("handrails", bm, mats["iron"], coll)
    log(f"grand gallery: {length:.2f} m at {r['gg.angle']:.2f} deg, {int(r['gg.corbel.count'])} corbels of "
        f"{r['gg.corbel.height']} m stepping {r['gg.corbel.overlap']} m, {r['gg.height']} m high")


def kings_chamber(state, coll, mats, log=print):
    r = _r()
    x0, x1 = r["kc.wall.west.east"], r["kc.wall.east.east"]
    y0, y1 = r["kc.wall.south.north"], r["kc.wall.north.north"]
    z0, z1 = r["kc.floor.elevation"], r["kc.ceiling.up"]
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                    (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([v[i] for i in f])
    _emit("king's chamber", bm, mats["chamber granite"], coll)
    # Nine beams across the roof, north to south, a hand's breadth proud of it.
    bm = bmesh.new()
    beam = (x1 - x0) / 9
    for k in range(9):
        _box(bm, x0 + k * beam + 0.012, x0 + (k + 1) * beam - 0.012, y0, y1, z1 - 0.07, z1)
    _emit("roof beams", bm, mats["chamber granite"], coll)
    # The coffer, from Petrie's mean planes and where it stood (§58-59): long axis north and south.
    L, W, H = r["kc.coffer.outside.length"], r["kc.coffer.outside.width"], r["kc.coffer.outside.height"]
    li, wi, di = r["kc.coffer.inside.length"], r["kc.coffer.inside.width"], r["kc.coffer.inside.depth"]
    west = x0 + (r["kc.coffer.nw.to_west_wall"] + r["kc.coffer.sw.to_west_wall"]) / 2
    north = y1 - r["kc.coffer.nw.to_north_wall"]
    cx, cy = west + W / 2, north - L / 2
    bm = bmesh.new()
    ends, sides, base = (L - li) / 2, (W - wi) / 2, H - di
    _box(bm, cx - W / 2, cx + W / 2, cy - L / 2, cy + L / 2, z0, z0 + base)                          # the base
    _box(bm, cx - W / 2, cx + W / 2, cy + L / 2 - ends, cy + L / 2, z0 + base, z0 + H)                # north end
    _box(bm, cx - W / 2, cx + W / 2, cy - L / 2, cy - L / 2 + ends, z0 + base, z0 + H)                # south end
    _box(bm, cx + W / 2 - sides, cx + W / 2, cy - L / 2 + ends, cy + L / 2 - ends, z0 + base, z0 + H)  # east side
    _box(bm, cx - W / 2, cx - W / 2 + sides, cy - L / 2 + ends, cy + L / 2 - ends, z0 + base, z0 + H - 0.043)  # west, cut down
    _emit("coffer", bm, mats["coffer granite"], coll)
    # The doorway at the east end of the north wall, and the two shafts' mouths.
    bm = bmesh.new()
    door_x = r["gg.floor.virtual_south_end.east"]
    dw = r["passage.ascending.width"] / 2
    bm.faces.new([bm.verts.new(p) for p in ((door_x - dw, y1 - 0.01, z0), (door_x + dw, y1 - 0.01, z0),
                                            (door_x + dw, y1 - 0.01, z0 + PASSAGE_HEIGHT), (door_x - dw, y1 - 0.01, z0 + PASSAGE_HEIGHT))])
    # The shafts' mouths at their outlets' offsets east, the shafts taken as straight in plan (the north one jogs).
    for yy, shaft_x, dy in ((y1, r["kc.shaft.north.outlet.east"], -0.01), (y0, r["kc.shaft.south.outlet.east"], 0.01)):
        bm.faces.new([bm.verts.new(p) for p in ((shaft_x - 0.1, yy + dy, z0 + 0.9), (shaft_x + 0.1, yy + dy, z0 + 0.9),
                                                (shaft_x + 0.1, yy + dy, z0 + 1.12), (shaft_x - 0.1, yy + dy, z0 + 1.12))])
    _emit("chamber mouths", bm, mats["dark"], coll)
    log(f"king's chamber: {x1 - x0:.2f} x {y1 - y0:.2f} x {z1 - z0:.2f} m in granite under nine beams; "
        f"the coffer {L:.3f} x {W:.3f} x {H:.3f} m, {west - x0:.2f} m off the west wall")
    return (x0, x1, y0, y1, z0, z1)


def queens_chamber(state, coll, mats, log=print):
    """
    The Queen's Chamber from §41-43: Petrie's mean length and width (g1.json), its floor and
    north wall (§64), the gabled roof springing from the north and south walls, and the
    corbelled niche in the east wall, its five tiers and four laps from §43's table. §64
    puts the east wall 236 in from the west against §41's 226.47 in length; the east wall
    is kept, since the passage from the gallery enters the north wall at its east corner
    and needs it there, and the west wall follows from the length. The shafts' mouths and
    the doorway's height are look choices.
    """
    r = _r()
    x1 = r["qc.corner.ne.east"]
    x0 = x1 - r["qc.length"]
    y1 = r["qc.corner.ne.north"]
    y0 = y1 - r["qc.width"]
    z0 = r["qc.corner.ne.up"]
    wall = z0 + r["qc.wall.height"]
    ridge_z = z0 + r["qc.gable.height"]
    ridge_y = r["qc.roof.mid_west.north"]
    bm = bmesh.new()
    V = bm.verts.new
    # Floor, the north and south walls, the two roof slopes and the west gable.
    bm.faces.new([V((x0, y0, z0)), V((x1, y0, z0)), V((x1, y1, z0)), V((x0, y1, z0))])
    bm.faces.new([V((x0, y1, z0)), V((x1, y1, z0)), V((x1, y1, wall)), V((x0, y1, wall))])
    bm.faces.new([V((x1, y0, z0)), V((x0, y0, z0)), V((x0, y0, wall)), V((x1, y0, wall))])
    bm.faces.new([V((x0, y1, wall)), V((x1, y1, wall)), V((x1, ridge_y, ridge_z)), V((x0, ridge_y, ridge_z))])
    bm.faces.new([V((x1, y0, wall)), V((x0, y0, wall)), V((x0, ridge_y, ridge_z)), V((x1, ridge_y, ridge_z))])
    bm.faces.new([V((x0, y0, z0)), V((x0, y1, z0)), V((x0, y1, wall)), V((x0, ridge_y, ridge_z)), V((x0, y0, wall))])
    # The east wall, band by band round the niche, then its gable.
    depth = r["qc.niche.depth"]
    yc = ridge_y - r["qc.niche.offset.south"]
    widths = [r[f"qc.niche.tier{k}.width"] for k in range(1, 6)]
    levels = [0.0] + [r[f"qc.niche.lap{k}.up"] for k in range(1, 5)] + [r["qc.niche.height"]]
    for k, w in enumerate(widths):
        za, zb = z0 + levels[k], z0 + levels[k + 1]
        s, n = yc - w / 2, yc + w / 2
        bm.faces.new([V((x1, y0, za)), V((x1, s, za)), V((x1, s, zb)), V((x1, y0, zb))])
        bm.faces.new([V((x1, n, za)), V((x1, y1, za)), V((x1, y1, zb)), V((x1, n, zb))])
        bm.faces.new([V((x1 + depth, s, za)), V((x1 + depth, n, za)), V((x1 + depth, n, zb)), V((x1 + depth, s, zb))])
        bm.faces.new([V((x1, s, za)), V((x1 + depth, s, za)), V((x1 + depth, s, zb)), V((x1, s, zb))])
        bm.faces.new([V((x1 + depth, n, za)), V((x1, n, za)), V((x1, n, zb)), V((x1 + depth, n, zb))])
        if k > 0:          # the lap: the narrower tier above overhangs the one below
            wb = widths[k - 1]
            for a, b in ((yc - wb / 2, s), (n, yc + wb / 2)):
                bm.faces.new([V((x1, a, za)), V((x1, b, za)), V((x1 + depth, b, za)), V((x1 + depth, a, za))])
    top = z0 + levels[-1]
    s, n = yc - widths[-1] / 2, yc + widths[-1] / 2
    bm.faces.new([V((x1, s, top)), V((x1, n, top)), V((x1 + depth, n, top)), V((x1 + depth, s, top))])
    bm.faces.new([V((x1, y0, top)), V((x1, y1, top)), V((x1, y1, wall)), V((x1, y0, wall))])
    bm.faces.new([V((x1, y0, wall)), V((x1, y1, wall)), V((x1, ridge_y, ridge_z))])
    _emit("queen's chamber", bm, mats["qc limestone"], coll)
    # The doorway at the east end of the north wall, and the shafts' mouths.
    bm = bmesh.new()
    V = bm.verts.new          # bound to the new mesh: the old one was freed by _emit
    door_x = r["passage.ascending.floor.end.east"]
    dw = r["passage.ascending.width"] / 2
    bm.faces.new([V((door_x - dw, y1 - 0.01, z0)), V((door_x + dw, y1 - 0.01, z0)),
                  V((door_x + dw, y1 - 0.01, z0 + PASSAGE_HEIGHT)), V((door_x - dw, y1 - 0.01, z0 + PASSAGE_HEIGHT))])
    for yy, dy in ((y1, -0.01), (y0, 0.01)):
        cx = (x0 + x1) / 2
        bm.faces.new([V((cx - 0.1, yy + dy, z0 + 1.5)), V((cx + 0.1, yy + dy, z0 + 1.5)),
                      V((cx + 0.1, yy + dy, z0 + 1.7)), V((cx - 0.1, yy + dy, z0 + 1.7))])
    _emit("queen's chamber mouths", bm, mats["dark"], coll)
    log(f"queen's chamber: {x1 - x0:.2f} x {y1 - y0:.2f} m, walls {wall - z0:.2f} m, ridge {ridge_z - z0:.2f} m; "
        f"the niche {widths[0]:.2f} m narrowing to {widths[-1]:.2f} m in five tiers, {depth:.2f} m deep")
    return (x0, x1, y0, y1, z0, ridge_z)


def _sheet(name, P, keep, material, coll, flip=False):
    """
    A smooth-shaded sheet from a (rows, columns, 3) array of points; `keep[j, i]` says whether
    the quad whose lower corner is (j, i) is laid. `flip` turns its faces the other way.
    """
    import numpy as np
    ny, nx = P.shape[:2]
    j, i = np.nonzero(keep[:ny - 1, :nx - 1])
    a = j * nx + i
    quads = np.stack([a, a + 1, a + nx + 1, a + nx], axis=1)
    if flip:
        quads = quads[:, ::-1]
    me = bpy.data.meshes.new(name)
    me.from_pydata(P.reshape(-1, 3).tolist(), [], quads.tolist())
    me.validate()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def subterranean_chamber(state, coll, mats, log=print):
    """
    The unfinished chamber cut in the bedrock under the pyramid, from §37 (g1-interior.json): its
    centre and roof, its walls' lengths north and south and its widths east and west, and the two
    passages at its north-east and south-east corners. Its floor was never finished: §37 gives it
    140 in under the roof over the flat eastern part, 155 on a knob beside the pit and 198 at the
    best worked surface round it, and the western part rises in rough masses of rock towards the
    roof. The eastern floor, the knob and the worked surface are set at those depths. Where the pit
    is and how deep, the masses' terraces and the quarrymen's trenches between them, the hewn
    roughness of the walls and roof, and how far the two passages run before the dark, are look
    choices.
    """
    import numpy as np
    from .noise import ValueNoise, smoothstep
    r = _r()
    cx, cy, roof = r["chamber.subterranean.centre.east"], r["chamber.subterranean.centre.north"], r["chamber.subterranean.centre.up"]
    y1 = r["passage.subterranean_north.end.north"]
    y0 = r["passage.subterranean_south.begin.north"]
    half_n, half_s = r["chamber.subterranean.length.north"] / 2, r["chamber.subterranean.length.south"] / 2
    half = max(half_n, half_s)
    flat = roof - r["chamber.subterranean.height"]
    knob, worked = roof - r["chamber.subterranean.depth.knob"], roof - r["chamber.subterranean.depth.worked"]
    pit = (cx + 1.6, cy - 0.8, 0.9)                                     # look choice: where the pit opens, and its half width
    nz = ValueNoise(37, 40.0)
    step = 0.07

    def floor_z(x, y):
        """
        The unfinished floor: flat in the east with a pick-worked skin, the pit's basin and the knob
        beside it, and in the west masses of rock left standing in rough terraces, split by trenches
        the quarrymen sank to free the next blocks, their east faces cut back nearly sheer.
        """
        skin = 0.025 * nz.fbm(x, y, 0.5, 3, key=1)
        east = flat + 0.06 * nz.fbm(x, y, 3.0, 2, key=2) + skin
        # The masses: a broad field quantised into terraces about 0.45 m high, the risers steep but not knife-cut.
        field = 0.5 + 0.5 * nz.fbm(x, y, 2.6, 3, key=3)
        tiers = (field * 5.0) + 3.0 * (cx - x) / half
        k = np.floor(tiers)
        terr = (k + smoothstep(0.78, 1.0, tiers - k)) / 5.0
        mass = roof - 0.45 - np.clip(1.0 - terr, 0.0, 1.0) * 2.6 + skin * 2.0
        # Trenches: two running east and west, one north and south, each about 0.6 m wide and sunk 1.2 m.
        def trench(d, w):
            return 1.0 - smoothstep(w * 0.35, w * 0.6, np.abs(d))
        wob = 0.35 * nz.fbm(x, y, 3.5, 2, key=4) + 0.06 * nz.fbm(x, y, 0.6, 2, key=8)
        cut = np.maximum.reduce([trench(y - (cy + 1.7) + wob + 0.08 * (x - cx), 0.7),
                                 trench(y - (cy - 2.0) + wob, 0.55) * smoothstep(cx - 6.5, cx - 5.5, x),
                                 trench(x - (cx - 3.4) + wob - 0.12 * (y - cy), 0.6) * smoothstep(cy - 3.6, cy - 2.4, y)])
        mass = mass - cut * 1.25
        # Where the masses begin: a ragged front about 1.2 m west of the centre, nearly sheer.
        # Round the pit, a squared cut: the worked surface a pace wide, a riser to the knob's level, a
        # second up to the flat floor, their edges as ragged as the picks left them.
        rag = 0.18 * nz.fbm(x, y, 0.9, 2, key=7)
        d = 0.75 * np.maximum(np.abs(x - pit[0]), np.abs(y - pit[1])) + 0.25 * np.hypot(x - pit[0], y - pit[1]) + rag
        basin = worked + (knob - worked) * smoothstep(1.45, 1.6, d) + (flat - knob) * smoothstep(1.95, 2.1, d) + skin
        near = smoothstep(2.3, 2.1, d)
        east = east * (1 - near) + np.minimum(east, basin) * near
        front = cx - 0.1 + 0.7 * nz.fbm(x, y, 2.0, 2, key=5)
        west = smoothstep(front, front - 0.45, x)
        z = np.maximum(east, east * (1 - west) + mass * west)
        # The floor cut down to the drift's sill at the south-east corner, where it leaves 0.58 m below the flat.
        sill = r["passage.subterranean_south.begin.up"]
        dd = np.hypot((x - r["passage.subterranean_south.begin.east"]) / 1.6, (y - y0) / 1.4)
        w = smoothstep(1.3, 0.9, dd)
        z = z * (1 - w) + np.minimum(z, sill + skin + (flat - sill) * smoothstep(0.4, 0.9, dd)) * w
        return np.minimum(z, roof - 0.12)

    mat = mats["bedrock rough"]
    # The floor, laid 0.2 m past the walls on every side so that the hewn walls always cut it.
    xs = np.arange(cx - half - 0.2, cx + half + 0.2 + 1e-6, step)
    ys = np.arange(y0 - 0.2, y1 + 0.2 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    Z = floor_z(X, Y)
    # The pit's mouth snapped to the grid, so its walls share the floor's rim.
    i0, i1 = np.searchsorted(xs, pit[0] - pit[2]), np.searchsorted(xs, pit[0] + pit[2])
    j0, j1 = np.searchsorted(ys, pit[1] - pit[2]), np.searchsorted(ys, pit[1] + pit[2])
    keep = np.ones(X.shape, bool)
    keep[j0:j1, i0:i1] = False
    _sheet("subterranean floor", np.dstack([X, Y, Z]), keep, mat, coll)
    # The pit, sunk five metres (Perring took it deeper; its bottom is out of sight).
    bot = worked - 5.0
    rim = [(xs[i], ys[j0]) for i in range(i0, i1 + 1)] + [(xs[i1], ys[j]) for j in range(j0 + 1, j1 + 1)] + \
          [(xs[i], ys[j1]) for i in range(i1 - 1, i0 - 1, -1)] + [(xs[i0], ys[j]) for j in range(j1 - 1, j0 - 1, -1)]
    rx, ry = np.array([p[0] for p in rim]), np.array([p[1] for p in rim])
    top = floor_z(rx, ry)
    depths = np.linspace(0.0, 1.0, 40)[:, None]
    PZ = top[None, :] * (1 - depths) + bot * depths
    ox, oy = rx - pit[0], ry - pit[1]
    n = np.hypot(ox, oy)
    jag = 0.04 * nz.fbm(np.broadcast_to(rx + ry, PZ.shape), PZ, 0.4, 3, key=6)
    PX, PY = rx[None, :] + ox / n * jag, ry[None, :] + oy / n * jag
    PX[0], PY[0] = rx, ry
    _sheet("subterranean pit", np.dstack([PX, PY, PZ]), np.ones(PX.shape, bool), mat, coll)
    # The walls: each a sheet from below the lowest floor to over the roof, hewn in and out about 5 cm,
    # with holes where the two passages leave.
    lo = min(float(Z.min()), flat - 0.4) - 0.2
    passages = {
        "north": (r["passage.subterranean_north.end.east"], r["passage.subterranean_north.end.up"],
                  r["passage.subterranean.width"], r["passage.subterranean.height"], 3.5),
        "south": (r["passage.subterranean_south.begin.east"], r["passage.subterranean_south.begin.up"], 0.72, 0.76, 5.0),
    }
    corners = [(cx - half_s, y0), (cx + half_s, y0), (cx + half_n, y1), (cx - half_n, y1)]
    names = ("south", "east", "north", "west")
    for k in range(4):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
        length = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / length, (by - ay) / length
        nx_, ny_ = uy, -ux                                       # outward, the corners being walked anticlockwise
        s = np.arange(-0.15, length + 0.15 + 1e-6, step)
        zz = np.arange(lo, roof + 0.15 + 1e-6, step)
        S, ZZ = np.meshgrid(s, zz)
        BX, BY = ax + ux * S, ay + uy * S
        hew = 0.05 * nz.fbm(BX + BY, ZZ, 1.2, 4, key=10 + k) + 0.015 * nz.fbm(BX - BY, ZZ * 2.0, 0.18, 2, key=20 + k)
        WX, WY = BX + nx_ * hew, BY + ny_ * hew
        keep = np.ones(S.shape, bool)
        if names[k] in passages:
            px_, pz, pw, ph, _ = passages[names[k]]
            keep &= ~((np.abs(BX - px_) < pw / 2) & (ZZ > pz - 0.02) & (ZZ < pz + ph))
            keep[:-1, :-1] &= keep[1:, :-1] & keep[:-1, 1:] & keep[1:, 1:]
        _sheet(f"subterranean {names[k]} wall", np.dstack([WX, WY, ZZ]), keep, mat, coll, flip=True)
    # The roof: level, dressed no better than the walls.
    rxs = np.arange(cx - half - 0.2, cx + half + 0.2 + 1e-6, step * 1.5)
    rys = np.arange(y0 - 0.2, y1 + 0.2 + 1e-6, step * 1.5)
    RX, RY = np.meshgrid(rxs, rys)
    RZ = roof + 0.03 * nz.fbm(RX, RY, 0.9, 4, key=30) + 0.05 * nz.fbm(RX, RY, 4.0, 1, key=31)
    _sheet("subterranean roof", np.dstack([RX, RY, RZ]), np.ones(RX.shape, bool), mat, coll, flip=True)
    # The passages: square-cut tunnels running out of the chamber into the dark, the entrance passage
    # north from the north-east corner and the dead-end drift south from the south-east one.
    bm = bmesh.new()
    for name, sign, yw in (("north", 1.0, y1), ("south", -1.0, y0)):
        px_, pz, pw, ph, run = passages[name]
        ya, yb = yw - sign * 0.06, yw + sign * run
        _box(bm, px_ - pw / 2 - 0.15, px_ - pw / 2, min(ya, yb), max(ya, yb), pz - 0.15, pz + ph + 0.15)
        _box(bm, px_ + pw / 2, px_ + pw / 2 + 0.15, min(ya, yb), max(ya, yb), pz - 0.15, pz + ph + 0.15)
        _box(bm, px_ - pw / 2, px_ + pw / 2, min(ya, yb), max(ya, yb), pz - 0.15, pz)
        _box(bm, px_ - pw / 2, px_ + pw / 2, min(ya, yb), max(ya, yb), pz + ph, pz + ph + 0.15)
        _box(bm, px_ - pw / 2, px_ + pw / 2, yb, yb + sign * 0.15, pz, pz + ph)
    _emit("subterranean passages", bm, mat, coll)
    log(f"subterranean chamber: {2 * half_n:.2f} x {y1 - y0:.2f} m under a roof at {roof:.2f} m; the floor flat at "
        f"{flat:.2f} in the east, {worked:.2f} round the pit, rising in terraced masses in the west")
    return (cx - half_n, cx + half_n, y0, y1, flat, roof)


def _area(name, coll, at, size, emit, along, energy, colour):
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.shape = "RECTANGLE"
    lamp.size, lamp.size_y = size
    lamp.energy = energy
    lamp.color = colour
    ob = bpy.data.objects.new(name, lamp)
    coll.objects.link(ob)
    z = -Vector(emit).normalized()
    y = Vector(along)
    y = (y - y.project(z)).normalized()
    xax = y.cross(z)
    ob.matrix_world = Matrix.Translation(Vector(at)) @ Matrix((xax, y, z)).transposed().to_4x4()
    return ob


def _point(name, coll, at, energy, colour, radius):
    lamp = bpy.data.lights.new(name, "POINT")
    lamp.energy = energy
    lamp.color = colour
    lamp.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, lamp)
    coll.objects.link(ob)
    ob.location = at
    return ob


def lights(state, coll, r, room, log=print):
    angle, length, y_foot, z_foot, y_top, z_top = _gallery_frame(r)
    x = r["gg.floor.virtual_south_end.east"]
    half = r["gg.floor.width"] / 2 + r["gg.ramp.width"]
    step_y = r["gg.step.top.north"]
    x0, x1, y0, y1, z0, z1 = room
    lamps = []
    slope = (0.0, -math.cos(angle), math.sin(angle))
    if state in MODERN:
        warm = (1.0, 0.82, 0.6)
        y = y_foot - 1.4
        while y > step_y + 1.0:
            for side in (-1, 1):
                at = (x + side * (half - 0.1), y, floor_z(r, y) + RAMP_HEIGHT + 0.04)
                lamps.append(_area("gallery strip", coll, at, (0.08, 2.0), (side * 0.12, 0.0, 1.0), slope, 40.0, warm))
            y -= 2.4
        for yy, sign in ((y1 - 0.12, 1.0), (y0 + 0.12, -1.0)):     # each washes the wall behind it
            for fx in (0.4, 0.63, 0.86):                           # kept clear of the coffer, which they would burn out
                at = (x0 + (x1 - x0) * fx, yy, z0 + 0.06)
                lamps.append(_area("chamber strip", coll, at, (2.4, 0.08), (0.0, sign * 0.2, 1.0), (1.0, 0.0, 0.0), 110.0, warm))
        # A softer wash up the west wall, so the coffer stands dark against lit granite.
        lamps.append(_area("chamber strip", coll, (x0 + 0.12, (y0 + y1) / 2, z0 + 0.06), (0.08, 4.4), (-0.2, 0.0, 1.0), (0.0, 1.0, 0.0), 70.0, warm))
        log(f"interior light: {len(lamps)} electric strips")
    else:
        flame = (1.0, 0.52, 0.2)
        for k in range(8):
            yy = y_foot - 2.0 - k * (y_foot - step_y - 4.0) / 7
            side = -1 if k % 2 else 1
            lamps.append(_point("oil lamp", coll, (x + side * (half - 0.26), yy, floor_z(r, yy) + RAMP_HEIGHT + 0.12), 16.0, flame, 0.03))
        for fx, fy, watts in ((0.34, 0.15, 40.0), (0.46, 0.85, 40.0), (0.6, 0.2, 40.0), (0.75, 0.8, 40.0), (0.9, 0.3, 40.0),
                              (0.04, 0.9, 14.0)):          # none within 1.5 m of the coffer; a small one behind it
            lamps.append(_point("oil lamp", coll, (x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy, z0 + 0.12), watts, flame, 0.03))
        log(f"interior light: {len(lamps)} oil lamps")
    return lamps


def rough_rock(name, colours, soot=0.0):
    """Bedrock left as the quarrymen's picks left it: blotched, lumpy, sooted towards the roof."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    col = t.ramp(t.noise(pos, 0.9, 3.0, 0.5), [(0.3, hexlin(colours[0])), (0.7, hexlin(colours[1]))])
    # The limestone's beds: level bands a hand or two thick, a little warmer or greyer, wandering slightly.
    wander = t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.5, 3.0), 0.5), 0.7)
    bed = t.math("SINE", t.math("MULTIPLY", t.math("ADD", sep.outputs["Z"], wander), 2 * math.pi / 0.45))
    fade = t.band(t.noise(pos, 0.9, 2.0), 0.35, 0.7)          # beds that show here and fade there
    nrm = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nrm.inputs[0])
    fade = t.math("MULTIPLY", fade, t.band(t.math("ABSOLUTE", nrm.outputs["Z"]), 0.8, 0.4))   # on cut faces, not floors
    col = t.mix(t.math("MULTIPLY", t.math("MULTIPLY", t.band(bed, 0.7, 1.0), fade), 0.2), col, hexlin("7a6a55"))
    if soot:
        grime = t.math("MULTIPLY", t.band(sep.outputs["Z"], -30.0, -27.0), soot)
        grime = t.math("MULTIPLY", grime, t.math("ADD", 0.75, t.math("MULTIPLY", t.noise(pos, 3.0, 2.0), 0.25)))
        col = t.mix(grime, col, hexlin("2a241e"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.93
    # The picks' bites: small facets a few centimetres across over a lumpier hewn surface.
    vor = t.node("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 10.0
    t.link(pos, vor.inputs["Vector"])
    height = t.math("ADD", t.math("MULTIPLY", t.noise(pos, 4.0, 8.0, 0.7), 0.7), t.math("MULTIPLY", vor.outputs["Distance"], 0.3))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.55
    bmp.inputs["Distance"].default_value = 0.05
    t.link(height, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def subterranean_lights(state, coll, room, log=print):
    """
    Low light that rakes across the rock, so the masses and trenches read: today two work lamps
    on the eastern floor, one in the pit's basin and a small one hidden in the far trench, with a
    glow down the entrance passage; three oil lamps on the floor and one on a mass before.
    """
    x0, x1, y0, y1, flat, roof = room
    lamps = []
    modern = state in MODERN
    colour = (1.0, 0.8, 0.58) if modern else (1.0, 0.6, 0.3)
    if modern:
        # work lamps on stands, high enough that no floor burns out under them; one up among the masses
        spots = ((0.86, 0.22, 1.7, 55.0), (0.72, 0.8, 1.9, 40.0), (0.52, 0.2, 1.3, 14.0), (0.12, 0.62, 0.6, 14.0),
                 (0.3, 0.4, 2.2, 6.0))
    else:
        spots = ((0.85, 0.3, 0.35, 14.0), (0.62, 0.75, 0.3, 12.0), (0.5, 0.2, 0.3, 7.0), (0.3, 0.45, 0.4, 6.0))
    for fx, fy, up, watts in spots:
        at = (x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy, flat + up)
        lamps.append(_point("subterranean lamp", coll, at, watts, colour, 0.18 if modern else 0.02))
    if modern:          # the entrance passage lit a few metres up towards the descending passage
        r = _r()
        lamps.append(_point("subterranean lamp", coll, (r["passage.subterranean_north.end.east"], y1 + 2.4,
                                                        r["passage.subterranean_north.end.up"] + 0.7), 12.0, colour, 0.03))
    log(f"subterranean light: {len(lamps)} lamps")
    return lamps


def queens_lights(state, coll, room, log=print):
    """Two strips at the foot of the long walls today; three oil lamps on the floor before."""
    x0, x1, y0, y1, z0, _ = room
    lamps = []
    if state in MODERN:
        warm = (1.0, 0.82, 0.6)
        for yy, sign in ((y1 - 0.12, 1.0), (y0 + 0.12, -1.0)):
            at = ((x0 + x1) / 2, yy, z0 + 0.06)
            lamps.append(_area("queen's strip", coll, at, (3.6, 0.08), (0.0, sign * 0.2, 1.0), (1.0, 0.0, 0.0), 90.0, warm))
    else:
        flame = (1.0, 0.52, 0.2)
        for fx, fy in ((0.25, 0.7), (0.55, 0.25), (0.8, 0.75)):
            lamps.append(_point("oil lamp", coll, (x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy, z0 + 0.12), 30.0, flame, 0.03))
    return lamps


def _flat(name, rgb, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    return mat


def build(state, coll, mats, log=print):
    """Build the gallery and the chamber into `coll`; returns the era's lamps, for the scene to switch."""
    r = _r()
    # Aswan's red granite: pink feldspar, grey quartz and black mica, muted enough that lamplight
    # does not turn it to orange plaster; the coffer's stone is darker, as it is.
    if state in MODERN:
        lime, granite, soot, rough, quartz = ("b2a38c", "c4b59d"), ("5a3830", "7a4a3e"), 0.75, 0.4, "6e6964"
    elif state == "stripped":
        lime, granite, soot, rough, quartz = ("a89985", "baab95"), ("45322d", "5a413a"), 0.9, 0.55, "66615c"
    else:
        lime, granite, soot, rough, quartz = ("e7e0d0", "f1ebdf"), ("6b4c44", "82605a"), 0.0, 0.34, "8e8984"
    coffer = tuple("%02x%02x%02x" % tuple(int(int(c[i:i + 2], 16) * 0.72) for i in (0, 2, 4)) for c in granite)
    mats["gallery stone"] = masonry("gallery stone", lime, rough, r["gg.corbel.height"], 1.9, gallery_frame(r),
                                    soot=soot, height=r["gg.height"])
    course = (r["kc.ceiling.up"] - r["kc.floor.elevation"]) / KC_COURSES
    mats["chamber granite"] = masonry("chamber granite", granite, rough * 0.8, course, 2.1, room_frame(r["kc.floor.elevation"]),
                                      soot=soot * 0.8, height=course * KC_COURSES, joint=0.8, speckle="1c1715", mortar=0.01,
                                      quartz=quartz)
    mats["coffer granite"] = masonry("coffer granite", coffer, rough, 10.0, 10.0, room_frame(r["kc.floor.elevation"]),
                                     joint=0.0, speckle="161210", quartz=quartz)
    mats["qc limestone"] = masonry("qc limestone", lime, rough, 0.8, 1.7, room_frame(r["qc.corner.ne.up"]),
                                   soot=soot * 0.6, height=r["qc.gable.height"])
    mats["bedrock rough"] = rough_rock("bedrock rough", ("8f7f68", "a8977d") if state in MODERN or state == "stripped" else ("b7a88f", "cbbca2"),
                                       soot=0.45 if state in MODERN or state == "stripped" else 0.15)
    mats.setdefault("timber", _flat("timber", (0.24, 0.15, 0.08), 0.7))
    mats.setdefault("iron", _flat("iron", (0.05, 0.05, 0.05), 0.4))
    gallery(state, coll, mats, log)
    room = kings_chamber(state, coll, mats, log)
    queen = queens_chamber(state, coll, mats, log)
    under = subterranean_chamber(state, coll, mats, log)
    return (lights(state, coll, r, room, log) + queens_lights(state, coll, queen, log)
            + subterranean_lights(state, coll, under, log))
