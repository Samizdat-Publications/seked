"""
The pyramid builders' town (Heit el-Ghurab) south of the Wall of the Crow, as built.

An impression, not a survey: the general layout AERA has published from its excavations
since 1988 (Lehner and colleagues) drawn schematically. Galleries in four blocks with
streets between them, where the rotating crews slept and worked; the Royal Administrative
Building with its round granaries in a walled court; the Eastern Town's packed small
houses and the Western Town's larger ones. No position, size or height here is taken from
a plan or a measurement: every one is a look choice, and the town is labelled a stand-in
wherever it is shown. Mudbrick walls, mud-plastered flat roofs, some rooms open to the sky.
Only the as-built era has it; the town was abandoned with the Fourth Dynasty and lies
under sand after.
"""
import random

from . import states

try:                     # extents() is read by the vegetation masks, which are tested without Blender
    import bmesh
    import bpy
    from .nodes import Tree, hexlin
except ImportError:
    bmesh = bpy = None

# The town's frame: its north-west corner south of the Wall of the Crow, streets running east.
ORIGIN = (470.0, -805.0)
GALLERY = dict(length=34.0, width=4.8, wall=0.8, height=3.2)
BLOCKS = [(0, 0), (1, 0), (0, 1), (1, 1)]       # four blocks of galleries, two by two
PER_BLOCK = 9
STREET = 5.0
RAB = dict(x=415.0, y=-915.0, w=50.0, d=38.0, wall=2.6, height=4.2, silos=8)
EAST_TOWN = (600.0, 675.0, -885.0, -805.0)
WEST_TOWN = (400.0, 462.0, -870.0, -812.0)


def extents(state):
    """Where the town stands, (x0, x1, y0, y1), for the vegetation to keep out of."""
    if states.spec(state)["pyramids"] != "dressed":
        return []
    return [(WEST_TOWN[0] - 2.0, EAST_TOWN[1] + 2.0, RAB["y"] - 2.0, ORIGIN[1] + 2.0)]


def plaster_material(name="mud plaster", colours=("9c8566", "ad9573")):
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    col = t.ramp(t.noise(geo.outputs["Position"], 0.6, 5.0), [(0.3, hexlin(colours[0])), (0.7, hexlin(colours[1]))])
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    return mat


class _Boxes:
    """Axis-aligned boxes, each with its own base, gathered into one mesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.n = 0

    def add(self, x0, x1, y0, y1, z0, z1):
        v = [self.bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.bm.faces.new([v[i] for i in f])
        self.n += 1

    def emit(self, name, material, coll):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        me.materials.append(material)
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        ob["seked"] = "stand-in: an impression of the builders' town, not a survey"
        return ob


def _room(walls, roofs, x0, x1, y0, y1, z, height, wall, rng, door_side="s", roofed=True):
    """A rectangular room: four walls with a doorway, and a flat roof or none."""
    door = 1.0
    zt = z + height
    for side in ("n", "s", "e", "w"):
        if side in "ns":
            yy = y1 - wall if side == "n" else y0
            if side == door_side:
                mid = (x0 + x1) / 2
                walls.add(x0, mid - door / 2, yy, yy + wall, z, zt)
                walls.add(mid + door / 2, x1, yy, yy + wall, z, zt)
                walls.add(mid - door / 2, mid + door / 2, yy, yy + wall, z + 2.0, zt)
            else:
                walls.add(x0, x1, yy, yy + wall, z, zt)
        else:
            xx = x1 - wall if side == "e" else x0
            walls.add(xx, xx + wall, y0 + wall, y1 - wall, z, zt)
    if roofed:
        roofs.add(x0 - 0.1, x1 + 0.1, y0 - 0.1, y1 + 0.1, zt, zt + 0.22)


def build(state, terrain, coll, mats, log=print, rng=None):
    if states.spec(state)["pyramids"] != "dressed":
        return
    rng = rng or random.Random(41)
    walls, roofs, grain = _Boxes(), _Boxes(), _Boxes()
    g = GALLERY
    block_w = PER_BLOCK * g["width"]
    ox, oy = ORIGIN
    galleries = 0
    for bx, by in BLOCKS:
        x_block = ox + bx * (block_w + STREET)
        y_top = oy - by * (g["length"] + STREET)
        for k in range(PER_BLOCK):
            x0 = x_block + k * g["width"]
            x1 = x0 + g["width"] + g["wall"]
            y1, y0 = y_top, y_top - g["length"]
            z = float(terrain.surface([(x0 + x1) / 2], [(y0 + y1) / 2])[0]) - 0.1
            # A long hall open to its colonnaded front on the street to the south, roofed at the back.
            _room(walls, roofs, x0, x1, y0, y1, z, g["height"] + rng.uniform(-0.2, 0.2), g["wall"], rng,
                  door_side="s", roofed=rng.random() > 0.12)
            galleries += 1
    # The Royal Administrative Building: a thick-walled court with its granaries.
    r = RAB
    z = float(terrain.surface([r["x"] + r["w"] / 2], [r["y"] + r["d"] / 2])[0]) - 0.1
    x0, x1, y0, y1 = r["x"], r["x"] + r["w"], r["y"], r["y"] + r["d"]
    for a in (("n", x0, x1, y1 - r["wall"], y1), ("s", x0, x1, y0, y0 + r["wall"])):
        walls.add(a[1], a[2], a[3], a[4], z, z + r["height"])
    walls.add(x0, x0 + r["wall"], y0, y1, z, z + r["height"])
    walls.add(x1 - r["wall"], x1, y0, (y0 + y1) / 2 - 1.5, z, z + r["height"])
    walls.add(x1 - r["wall"], x1, (y0 + y1) / 2 + 1.5, y1, z, z + r["height"])
    silo_mesh = []
    for k in range(r["silos"]):
        sx = x0 + 8.0 + (k % 4) * 8.5
        sy = y0 + 10.0 + (k // 4) * 14.0
        silo_mesh.append((sx, sy, z))
    # The Eastern Town: small houses packed along lanes; the Western Town: fewer, larger.
    houses = 0
    for (xa, xb, ya, yb), size, gap in ((EAST_TOWN, (4.0, 7.5), 1.6), (WEST_TOWN, (8.0, 14.0), 3.0)):
        y = yb
        while y > ya + size[0]:
            depth = rng.uniform(*size)
            x = xa
            while x < xb - size[0]:
                w = rng.uniform(*size)
                if rng.random() < 0.88:
                    zz = float(terrain.surface([x + w / 2], [y - depth / 2])[0]) - 0.1
                    _room(walls, roofs, x, x + w, y - depth, y, zz, rng.uniform(2.4, 3.1), 0.5, rng,
                          door_side=rng.choice("nsew"), roofed=rng.random() > 0.25)
                    houses += 1
                x += w + (gap if rng.random() < 0.3 else 0.3)
            y -= depth + gap
    mud = mats.get("mudbrick")
    walls.emit("builders' town walls", mud, coll)
    roofs.emit("builders' town roofs", plaster_material(), coll)
    # Granaries: squat cylinders with domed tops.
    bm = bmesh.new()
    for sx, sy, z in silo_mesh:
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.4, radius2=1.4, depth=2.6)
        for v in res["verts"]:
            v.co.x += sx
            v.co.y += sy
            v.co.z += z + 1.3
        dome = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=1.4)
        for v in dome["verts"]:
            if v.co.z < 0:
                v.co.z = 0.0
            v.co.x += sx
            v.co.y += sy
            v.co.z = v.co.z * 0.8 + z + 2.6
    me = bpy.data.meshes.new("builders' town granaries")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(plaster_material("granary plaster", ("a38b69", "b49b77")))
    ob = bpy.data.objects.new("builders' town granaries", me)
    coll.objects.link(ob)
    log(f"builders' town: {galleries} galleries in {len(BLOCKS)} blocks, the administrative court with {r['silos']} granaries, "
        f"{houses} houses (an impression, not a survey)")
