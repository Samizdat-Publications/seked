"""
Inside the Great Pyramid: the Grand Gallery and the King's Chamber, from Petrie's interior
survey (data/measurements/g1-interior.json, all in the project frame: metres east of
Khufu's axis, north of it, and up from his base).

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
    return {rec["key"]: rec["value"] for rec in data.records("g1-interior.json")}


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


def masonry(name, colours, rough, course, width, frame, soot=0.0, height=6.0, joint=0.35, speckle=None, mortar=0.004):
    """
    Fine stone laid in courses, the joints drawn as hairlines. `frame(t, geo)` returns the
    (along, up, height-above-floor) sockets the courses are laid in, so the same material
    serves the sloping gallery and the level chamber. Soot darkens it towards the roof.
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
    if speckle:        # granite: a coarse crystal speckle
        vor = t.node("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 70.0
        t.link(geo.outputs["Position"], vor.inputs["Vector"])
        col = t.mix(t.math("MULTIPLY", t.band(vor.outputs["Distance"], 0.25, 0.0), 0.8), col, hexlin(speckle))
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
    for yy, shaft_x, dy in ((y1, 1.9, -0.01), (y0, 1.3, 0.01)):
        bm.faces.new([bm.verts.new(p) for p in ((shaft_x - 0.1, yy + dy, z0 + 0.9), (shaft_x + 0.1, yy + dy, z0 + 0.9),
                                                (shaft_x + 0.1, yy + dy, z0 + 1.12), (shaft_x - 0.1, yy + dy, z0 + 1.12))])
    _emit("chamber mouths", bm, mats["dark"], coll)
    log(f"king's chamber: {x1 - x0:.2f} x {y1 - y0:.2f} x {z1 - z0:.2f} m in granite under nine beams; "
        f"the coffer {L:.3f} x {W:.3f} x {H:.3f} m, {west - x0:.2f} m off the west wall")
    return (x0, x1, y0, y1, z0, z1)


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
                lamps.append(_area("chamber strip", coll, at, (2.4, 0.08), (0.0, sign * 0.2, 1.0), (1.0, 0.0, 0.0), 160.0, warm))
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
    if state in MODERN:
        lime, granite, soot, rough = ("b2a38c", "c4b59d"), ("4b332c", "5e4036"), 0.75, 0.5
    elif state == "stripped":
        lime, granite, soot, rough = ("a89985", "baab95"), ("45302a", "573b33"), 0.9, 0.55
    else:
        lime, granite, soot, rough = ("e7e0d0", "f1ebdf"), ("6a4337", "7e5041"), 0.0, 0.28
    mats["gallery stone"] = masonry("gallery stone", lime, rough, r["gg.corbel.height"], 1.9, gallery_frame(r),
                                    soot=soot, height=r["gg.height"])
    course = (r["kc.ceiling.up"] - r["kc.floor.elevation"]) / KC_COURSES
    mats["chamber granite"] = masonry("chamber granite", granite, rough * 0.8, course, 2.1, room_frame(r["kc.floor.elevation"]),
                                      soot=soot * 0.8, height=course * KC_COURSES, joint=0.8, speckle="1c1715", mortar=0.01)
    mats["coffer granite"] = masonry("coffer granite", granite, rough, 10.0, 10.0, room_frame(r["kc.floor.elevation"]),
                                     joint=0.0, speckle="1c1715")
    mats.setdefault("timber", _flat("timber", (0.24, 0.15, 0.08), 0.7))
    mats.setdefault("iron", _flat("iron", (0.05, 0.05, 0.05), 0.4))
    gallery(state, coll, mats, log)
    room = kings_chamber(state, coll, mats, log)
    return lights(state, coll, r, room, log)
