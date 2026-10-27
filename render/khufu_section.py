"""
Chapter 9's section: the Great Pyramid drawn as an x-ray, its passages and chambers from Petrie's interior survey
(data/measurements/g1-interior.json and g1.json), the ScanPyramids Big Void of 2017 as the zone its centre was placed
in, and the north-face corridor of 2023 in gold, so the leaf that calls it "what an answer looks like" can show where
in the pyramid the answer is.

    blender -b --factory-startup -P render/khufu_section.py -- --size 1600x1000 --samples 64 --out build/preview/khufu-section.png

The camera stands west of the pyramid looking east, so north is on the left as in the corridor's own drawing. The
stone is drawn half transparent: a diagram, not a view anyone could have. Every room, passage and void dimension is a
record; the LOOK table holds what the papers leave open, and goes into the JSON written beside the PNG.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import renderer  # noqa: E402
from giza.diagram import box, clear, material, mesh, polyline  # noqa: E402

REPO = os.path.dirname(HERE)
LOOK = {
    "corridor east of the axis (m)": 7.28,       # on the entrance's line, under the chevrons, where the endoscope went in
    "corridor set back from the original face (m)": 4.0,   # the lost casing and the chevron stones, before the 0.84 m
    "Big Void: drawn horizontal, its length centred over the gallery": True,   # the 2017 paper leaves its slope open
    "Big Void: cross-section (m)": (2.0, 6.0),    # width and height: unknown, drawn as a band
    "rock under the base, drawn to (m)": 40.0,
    "King's Chamber shafts drawn straight": True,
}


def records(name):
    with open(os.path.join(REPO, "data", "measurements", name), encoding="utf-8") as f:
        d = json.load(f)
    out = {}
    for r in (d if isinstance(d, list) else d["records"]):
        out.setdefault(r["key"], r["value"])      # the first record of a key: the file's preferred source
    return out


def parse(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    it = iter(argv)
    return {k.lstrip("-"): next(it) for k in it}


def slab(name, a, b, width, height, mat, coll):
    """A passage between floor points a and b (x, y, z): `width` across in x, `height` up from the floor."""
    x0, x1 = a[0] - width / 2, a[0] + width / 2
    v = [(x0, a[1], a[2]), (x1, a[1], a[2]), (x1, b[1], b[2]), (x0, b[1], b[2]),
         (x0, a[1], a[2] + height), (x1, a[1], a[2] + height), (x1, b[1], b[2] + height), (x0, b[1], b[2] + height)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(name, v, f, mat, coll)


def outline(ob, mat, thickness=0.12):
    wire = ob.modifiers.new("outline", "WIREFRAME")
    wire.thickness = thickness
    wire.use_replace = False
    wire.material_offset = 1
    ob.data.materials.append(mat)


def build(coll):
    g, r, v = records("g1.json"), records("g1-interior.json"), records("g1-voids.json")
    half, H = g["g1.base.side.mean"] / 2, g["g1.height.original"]
    M = dict(
        stone=material("pyramid (x-ray)", (0.86, 0.78, 0.62), alpha=0.13, rough=0.9),
        edge=material("pyramid edges", (0.95, 0.88, 0.72), emit=0.9),
        rock=material("bedrock (x-ray)", (0.62, 0.52, 0.38), alpha=0.22, strata=True),
        room=material("excavated", (0.12, 0.10, 0.09), rough=0.9),
        line=material("excavated outline", (0.95, 0.90, 0.78), emit=1.4),
        shaft=material("shaft", (0.80, 0.76, 0.66), emit=0.8),
        void=material("Big Void zone", (0.55, 0.78, 1.0), alpha=0.22, emit=0.6),
        voidedge=material("Big Void edges", (0.55, 0.78, 1.0), emit=1.6, dashes=10.0, alpha=1.0),
        corridor=material("north-face corridor", (1.0, 0.72, 0.22), emit=6.0),
    )
    # the pyramid at its original height, and the bedrock under it
    p = [(-half, -half, 0), (half, -half, 0), (half, half, 0), (-half, half, 0), (0, 0, H)]
    mesh("Khufu", p, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)], M["stone"], coll)
    for a, b in [(0, 4), (1, 4), (2, 4), (3, 4), (0, 1), (1, 2), (2, 3), (3, 0)]:
        polyline("edge", [p[a], p[b]], 0.22, M["edge"], coll)
    d = LOOK["rock under the base, drawn to (m)"]
    box("bedrock", -half - 15, half + 15, -half - 15, half + 15, -d, 0, M["rock"], coll)

    rooms = []
    # descending passage, entrance to the subterranean chamber
    ent = (r["entrance.floor.begin.east"], r["entrance.floor.begin.north"], r["entrance.floor.begin.up"])
    dend = (r["passage.descending.floor.end.east"], r["passage.descending.floor.end.north"], r["passage.descending.floor.end.up"])
    hd = r["passage.descending.height"] / math.cos(math.radians(g["passage.descending.angle"]))
    rooms.append(slab("descending passage", ent, dend, r["passage.descending.width"], hd, M["room"], coll))
    sn = (r["passage.subterranean_north.end.east"], r["passage.subterranean_north.end.north"], r["passage.subterranean_north.end.up"])
    rooms.append(slab("subterranean passage", dend, sn, r["passage.subterranean.width"], r["passage.subterranean.height"], M["room"], coll))
    cx, cy, cz = r["chamber.subterranean.centre.east"], r["chamber.subterranean.centre.north"], r["chamber.subterranean.centre.up"]
    lx, ly, lz = r["chamber.subterranean.length.north"] / 2, r["chamber.subterranean.width.east"] / 2, r["chamber.subterranean.height"] / 2
    rooms.append(box("subterranean chamber", cx - lx, cx + lx, cy - ly, cy + ly, cz - lz, cz + lz, M["room"], coll))
    # ascending passage, Grand Gallery, horizontal passage to the Queen's Chamber
    a0 = (r["passage.ascending.floor.begin.east"], r["passage.ascending.floor.begin.north"], r["passage.ascending.floor.begin.up"])
    a1 = (r["passage.ascending.floor.end.east"], r["passage.ascending.floor.end.north"], r["passage.ascending.floor.end.up"])
    ha = r["passage.ascending.height"] / math.cos(math.radians(g["passage.ascending.angle"]))
    rooms.append(slab("ascending passage", a0, a1, r["passage.ascending.width"], ha, M["room"], coll))
    ang = math.radians(r["gg.angle"])
    gs = (r["gg.floor.virtual_south_end.east"], r["gg.floor.virtual_south_end.north"], r["gg.floor.virtual_south_end.up"])
    gf = (gs[0], gs[1] + r["gg.length"] * math.cos(ang), gs[2] - r["gg.length"] * math.sin(ang))
    gw = r["gg.floor.width"] + 2 * r["gg.ramp.width"]
    rooms.append(slab("Grand Gallery", gf, gs, gw, r["gg.height"], M["room"], coll))
    qx, qy, qz = r["qc.corner.ne.east"], r["qc.corner.ne.north"], r["qc.corner.ne.up"]
    ql, qw = g["qc.length"], g["qc.width"]
    rooms.append(slab("passage to the Queen's Chamber", (gf[0], gf[1], qz), (gf[0], qy, qz), r["passage.ascending.width"],
                      r["passage.ascending.height"], M["room"], coll))
    q = box("Queen's Chamber", qx - ql, qx, qy - qw, qy, qz, qz + r["qc.wall.height"], M["room"], coll)
    rooms.append(q)
    ridge = qz + g["qc.gable.height"]
    gv = [(qx - ql, qy - qw, qz + r["qc.wall.height"]), (qx, qy - qw, qz + r["qc.wall.height"]),
          (qx, qy, qz + r["qc.wall.height"]), (qx - ql, qy, qz + r["qc.wall.height"]),
          (qx, qy - qw / 2, ridge), (qx - ql, qy - qw / 2, ridge)]
    rooms.append(mesh("Queen's Chamber gable", gv, [(0, 1, 4, 5), (2, 3, 5, 4), (1, 2, 4), (3, 0, 5), (0, 3, 2, 1)], M["room"], coll))
    # antechamber and King's Chamber
    an = (r["antechamber.floor.north_end.east"], r["antechamber.floor.north_end.north"], r["antechamber.floor.north_end.up"])
    rooms.append(slab("passage to the King's Chamber", (gs[0], r["gg.step.top.north"], an[2]),
                      (gs[0], r["kc.wall.north.north"], an[2]), r["passage.ascending.width"], r["antechamber.height"], M["room"], coll))
    kx0, kx1 = r["kc.wall.west.east"], r["kc.wall.east.east"]
    ky0, ky1 = r["kc.wall.south.north"], r["kc.wall.north.north"]
    kz0, kz1 = r["kc.floor.elevation"], r["kc.ceiling.up"]
    rooms.append(box("King's Chamber", kx0, kx1, ky0, ky1, kz0, kz1, M["room"], coll))
    for ob in rooms:
        outline(ob, M["line"], 0.1)
    # the King's Chamber shafts, from the chamber's walls at a metre up to their outlets on the faces
    face = math.tan(math.radians(g["g1.face.angle"]))
    for side, wall_y, sgn in (("south", ky0, -1), ("north", ky1, 1)):
        z1 = g[f"kc.shaft.{side}.outlet.up"]
        y1 = sgn * (half - z1 / face)
        polyline(f"King's Chamber {side} shaft", [(g[f"kc.shaft.{side}.outlet.east"], wall_y, kz0 + 1.0),
                                                   (g[f"kc.shaft.{side}.outlet.east"], y1, z1)], 0.18, M["shaft"], coll)
    # the Big Void (2017): at least 30 m long, its centre 40 to 50 m above the Queen's Chamber floor, over the gallery
    vl = v["void.big.length.min"]
    zc0 = qz + v["void.big.centre.from_queens_chamber_floor.min"]
    zc1 = qz + v["void.big.centre.from_queens_chamber_floor.max"]
    vw, vh = LOOK["Big Void: cross-section (m)"]
    ym = (gf[1] + gs[1]) / 2
    zb = box("Big Void zone", gs[0] - vw / 2, gs[0] + vw / 2, ym - vl / 2, ym + vl / 2, zc0 - vh / 2, zc1 + vh / 2, M["void"], coll)
    outline(zb, M["voidedge"], 0.18)
    # the north-face corridor (2023), measured: its floor 20 m up, 9.06 m north-south, 2.02 across, 2.18 high
    c = "void.north_face_corridor."
    fz, ch, cl, cw = v[c + "floor.up"], v[c + "height"], v[c + "width"], v[c + "length"]
    y_face = half - (fz + ch) / face                     # the original face at the corridor's roof
    yn = y_face - LOOK["corridor set back from the original face (m)"] - v[c + "from_north_face"]
    ex = LOOK["corridor east of the axis (m)"]
    nfc = box("north-face corridor", ex - cw / 2, ex + cw / 2, yn - cl, yn, fz, fz + ch, M["corridor"], coll)
    halo = box("north-face corridor halo", ex - cw, ex + cw, yn - cl - 1.5, yn + 1.5, fz - 1.5, fz + ch + 1.5,
               material("corridor glow", (1.0, 0.72, 0.22), alpha=0.25, emit=1.5), coll)
    # where each label points, in the frame; the exhibit's script projects them onto the picture
    anchors = {
        "corridor": (ex, yn - cl / 2, fz + ch),
        "void": (gs[0], ym, zc1 + vh / 2),
        "kings": ((kx0 + kx1) / 2, (ky0 + ky1) / 2, kz1),
        "queens": (qx - ql / 2, qy - qw / 2, ridge),
        "gallery": (gs[0], (gf[1] + gs[1]) / 2, (gf[2] + gs[2]) / 2 + r["gg.height"]),
        "subterranean": (cx, cy, cz - lz),
        "entrance": ent,
        "north": (0.0, half, 0.0),
        "south": (0.0, -half, 0.0),
    }
    return dict(corridor=dict(north_end=yn, floor=fz, east=ex), void=dict(z=[zc0, zc1], y=[ym - vl / 2, ym + vl / 2]),
                half=half, height=H, anchors=anchors)


def camera_and_light(shot):
    S = {
        "whole": dict(location=(-470.0, -30.0, 22.0), target=(0.0, 4.0, 40.0), lens=40.0),
        "north": dict(location=(-170.0, 150.0, 70.0), target=(5.0, 60.0, 30.0), lens=50.0),
    }[shot]
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = S["lens"]
    cam_data.clip_end = 5000.0
    cam = bpy.data.objects.new("camera", cam_data)
    cam.location = Vector(S["location"])
    cam.rotation_euler = (Vector(S["target"]) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 2.6
    sun_data.use_shadow = False                           # a diagram: no passage throws its shadow on the base
    sun = bpy.data.objects.new("sun", sun_data)
    az, el = math.radians(220.0), math.radians(40.0)      # look choice: from the south-west
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(sun)
    world = bpy.context.scene.world or bpy.data.worlds.new("world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.018, 0.022, 0.032, 1)
    bg.inputs["Strength"].default_value = 1.0
    return cam


def main():
    o = parse(sys.argv)
    w, h = (int(x) for x in o.get("size", "1600x1000").split("x"))
    shot = o.get("shot", "whole")
    out = os.path.abspath(o.get("out", os.path.join(REPO, "build", "preview", f"khufu-section-{shot}.png")))
    clear()
    scene = bpy.context.scene
    coll = bpy.data.collections.new("section")
    scene.collection.children.link(coll)
    placed = build(coll)
    cam = camera_and_light(shot)
    renderer.gpu(scene)
    renderer.configure(scene, exposure=0.0)
    scene.cycles.samples = int(o.get("samples", 64))
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.0
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    from bpy_extras.object_utils import world_to_camera_view
    at = {}
    for k, co in placed.pop("anchors").items():
        p = world_to_camera_view(scene, cam, Vector(co))
        at[k] = [round(p.x * w, 1), round((1 - p.y) * h, 1)]
    placed["labels_at_px"] = at
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump(dict(render=os.path.relpath(out, REPO), shot=shot, size=[w, h], placed=placed,
                       camera=dict(location=list(cam.location), rotation_euler=list(cam.rotation_euler), lens=cam.data.lens),
                       look_choices={k: v for k, v in LOOK.items()},
                       sources=["data/measurements/g1.json", "data/measurements/g1-interior.json", "data/measurements/g1-voids.json"]),
                  f, indent=1)


main()
