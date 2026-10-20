"""
Chapter 8's Labyrinth at scale: Amenemhat III's pyramid and the Labyrinth's chip bed, as Petrie measured them
at Hawara, laid on the Giza plateau beside the Great Pyramid at the same scale (night decision 26), to be
labelled by the page "at Hawara, 80 km south; laid here for scale".

    blender -b --factory-startup -P render/labyrinth.py -- --size 1600x900 --samples 32
    blender -b --factory-startup -P render/labyrinth.py -- --at hawara      # the group where it stands, on flat ground

With `--at hawara` the same group stands at Hawara in stone: the pyramid cased as Petrie derived it (a
reconstruction: its brick core stands today), the chip bed as the excavated ground south of it. No surface
model of Hawara is imported, so its ground is drawn flat, and the canal has no record yet, so it is not drawn.

The ground is GLO-30 (data/terrain), with the three pyramids' sites flattened as the scene flattens them; the
pyramids are plain solids from render/giza/data.py; the Hawara group comes from render/giza/hawara.py and is
drawn as a translucent amber overlay, never as stone, because it is not here. Writes the PNG and a JSON with
the camera, the receipts and the layout.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import data, hawara as W, renderer  # noqa: E402
from giza.diagram import clear, material, mesh, polyline  # noqa: E402

REPO = os.path.dirname(HERE)
AREA = (-760.0, 760.0, -1000.0, 420.0)     # x0, x1, y0, y1 of the ground shown
STEP = 10.0


def parse(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    o = {}
    it = iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it)
    return o


def ground_z(xs, ys):
    """GLO-30 under the frame's origin, with each pyramid's site flattened to its base, as the scene does."""
    z = data.NEAR.sample(xs, ys).astype(np.float64) + data.TERRAIN_SHIFT
    for P in data.PYRAMIDS.values():
        inside = (np.abs(xs - P["cx"]) <= P["half"] + 6.0) & (np.abs(ys - P["cy"]) <= P["half"] + 6.0)
        z = np.where(inside, P["base"], z)
    return z


def terrain(coll, mat):
    x0, x1, y0, y1 = AREA
    xs = np.arange(x0, x1 + 1e-6, STEP)
    ys = np.arange(y0, y1 + 1e-6, STEP)
    X, Y = np.meshgrid(xs, ys)
    Z = ground_z(X.ravel(), Y.ravel()).reshape(X.shape)
    nx = len(xs)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i)
             for j in range(len(ys) - 1) for i in range(nx - 1)]
    ob = mesh("ground (GLO-30)", verts, faces, mat, coll)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def pyramid(name, cx, cy, half, H, base, mat, coll):
    v = [(cx - half, cy - half, base), (cx + half, cy - half, base), (cx + half, cy + half, base), (cx - half, cy + half, base), (cx, cy, base + H)]
    return mesh(name, v, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)], mat, coll)


def build(coll):
    M = dict(
        ground=material("ground", (0.78, 0.66, 0.49), rough=0.95),
        stone=material("pyramid limestone", (0.82, 0.74, 0.60), rough=0.8),
        ghost=material("Hawara, laid here", (1.0, 0.55, 0.15), alpha=0.6, emit=1.0),
        bed=material("Labyrinth chip bed, laid here", (1.0, 0.62, 0.22), alpha=0.35, emit=0.7),
        edge=material("overlay edge", (1.0, 0.70, 0.35), emit=2.2),
    )
    terrain(coll, M["ground"])
    for key, P in data.PYRAMIDS.items():
        pyramid(P["name"], P["cx"], P["cy"], P["half"], P["H"], P["base"], M["stone"], coll)
    g = W.laid_on_giza()
    p = g["pyramid"]
    base = float(np.median(ground_z(np.array([p["cx"] - p["half"], p["cx"] + p["half"], p["cx"], p["cx"]]),
                                    np.array([p["cy"], p["cy"], p["cy"] - p["half"], p["cy"] + p["half"]]))))
    pyramid("Hawara pyramid (laid here for scale)", p["cx"], p["cy"], p["half"], p["H"], base, M["ghost"], coll)
    cx, cy, hf, top = p["cx"], p["cy"], p["half"], base + p["H"]
    corners = [(cx - hf, cy - hf, base), (cx + hf, cy - hf, base), (cx + hf, cy + hf, base), (cx - hf, cy + hf, base)]
    polyline("Hawara pyramid base edge", corners, 0.6, M["edge"], coll, closed=True)
    for i, q in enumerate(corners):
        polyline("Hawara pyramid arris %d" % (i + 1), [q, (cx, cy, top)], 0.5, M["edge"], coll)
    # The chip bed draped on the ground a little above it, so it follows the plateau rather than floating.
    x0, x1, y0, y1 = g["bed"]
    xs = np.linspace(x0, x1, 31)
    ys = np.linspace(y0, y1, 25)
    X, Y = np.meshgrid(xs, ys)
    Z = ground_z(X.ravel(), Y.ravel()).reshape(X.shape) + 0.6
    nx = len(xs)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(len(ys) - 1) for i in range(nx - 1)]
    mesh("Labyrinth chip bed (laid here for scale)", verts, faces, M["bed"], coll)
    ring = [(x, y0) for x in xs] + [(x1, y) for y in ys[1:]] + [(x, y1) for x in xs[::-1][1:]] + [(x0, y) for y in ys[::-1][1:-1]]
    rz = ground_z(np.array([q[0] for q in ring]), np.array([q[1] for q in ring])) + 1.0
    polyline("chip bed edge", [(q[0], q[1], z) for q, z in zip(ring, rz)], 1.2, M["edge"], coll, closed=True)
    return g


def build_at_hawara(coll):
    if os.path.exists(os.path.join(REPO, "build", "textures", "index.json")):
        # the Giza scene's own CC0 photographed stone (python scripts/textures.py), as Enclosure D's stand-in uses
        from giza import materials as S
        M = dict(
            ground=S.stone("Fayum desert, drawn flat", "core", tex_role="sand", instanced=False, sand_tops=0.95, bump=0.1),
            stone=S.stone("limestone casing, as Petrie derived it", "tura_dressed", tex_role="casing", instanced=False, sand_tops=0.15),
            chips=S.stone("Labyrinth chip bed: limestone chips", "tura_dressed", tex_role="casing", instanced=False, sand_tops=0.5, bump=0.1),
        )
    else:
        M = dict(
            ground=material("Fayum desert, drawn flat", (0.72, 0.55, 0.36), rough=0.95),
            stone=material("limestone casing, as Petrie derived it", (0.86, 0.80, 0.68), rough=0.75),
            chips=material("Labyrinth chip bed", (0.90, 0.88, 0.82), rough=1.0),
        )
    mesh("ground (flat)", [(-30000, -30000, 0), (30000, -30000, 0), (30000, 30000, 0), (-30000, 30000, 0)], [(0, 1, 2, 3)], M["ground"], coll)
    g = W.at_hawara()
    p = g["pyramid"]
    pyramid("Amenemhat III's pyramid, cased", p["cx"], p["cy"], p["half"], p["H"], 0.0, M["stone"], coll)
    x0, x1, y0, y1 = g["bed"]
    v = [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0), (x0, y0, 0.4), (x1, y0, 0.4), (x1, y1, 0.4), (x0, y1, 0.4)]
    f = [(4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh("Labyrinth chip bed", v, f, M["chips"], coll)
    return g


VIEWS = dict(
    giza=dict(target=(-60.0, -250.0, 0.0), location=(640.0, -1120.0, 980.0), lens=38.0),
    hawara=dict(target=(0.0, -90.0, 12.0), location=(330.0, -470.0, 120.0), lens=32.0),   # from the south-east, a look choice
)


def camera_and_light(at="giza"):
    v = VIEWS[at]
    target = Vector(v["target"])
    loc = Vector(v["location"])
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = v["lens"]
    cam_data.clip_end = 20000.0
    cam = bpy.data.objects.new("camera", cam_data)
    cam.location = loc
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 2.2
    sun_data.angle = math.radians(1.0)
    sun = bpy.data.objects.new("sun", sun_data)
    # morning from the south-east at Giza; at Hawara late afternoon from the south-west, low, so the pyramid throws its shadow
    az, el = (math.radians(235.0), math.radians(14.0)) if at == "hawara" else (math.radians(125.0), math.radians(32.0))
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(sun)
    world = bpy.context.scene.world or bpy.data.worlds.new("world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.42, 0.55, 0.75, 1)
    bg.inputs["Strength"].default_value = 0.45
    return cam


def main():
    o = parse(sys.argv)
    w, hgt = (int(x) for x in o.get("size", "1600x900").split("x"))
    samples = int(o.get("samples", 32))
    at = o.get("at", "giza")
    out = o.get("out", os.path.join(REPO, "build", "preview", "labyrinth-at-%s.png" % at))
    clear()
    scene = bpy.context.scene
    coll = bpy.data.collections.new("labyrinth")
    scene.collection.children.link(coll)
    g = build_at_hawara(coll) if at == "hawara" else build(coll)
    cam = camera_and_light(at)
    renderer.gpu(scene)
    renderer.configure(scene, exposure=0.0)
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = w, hgt
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.3 if at == "hawara" else -0.5
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    meta = dict(render=os.path.relpath(out, REPO), size=[w, hgt], samples=samples,
                camera=dict(location=list(cam.location), rotation_euler=list(cam.rotation_euler), lens=cam.data.lens,
                            sensor_width=cam.data.sensor_width),
                figures=W.figures(), receipts=W.ratios(), layout=W.LAYOUT, laid=g, at=at,
                label="at Hawara, 80 km south; laid here for scale" if at == "giza" else
                "at Hawara: the pyramid cased as Petrie derived it (a reconstruction), the chip bed as excavated; "
                "the ground drawn flat, no surface model imported; the canal not drawn, no record")
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("wrote", out)


main()
