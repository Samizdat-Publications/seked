"""
Chapter 8's Hawara section: north-south through the Labyrinth's chip bed, south of Amenemhat III's pyramid,
seen from the east, with every layer from data/measurements/hawara.json.

    blender -b --factory-startup -P render/hawara_section.py -- --size 1600x900 --samples 24

Depths are drawn four times their true size (VEX), stated in the JSON beside the PNG, because 15 m of ground
under 250 m of field would otherwise be a line. What is excavated is drawn as stone (Petrie's chips), what is
instrumented as solid boxes (Elshazly's closures, the water table, the limestone), what is claimed as dashed
orange outlines (the Mataha walls), and Herodotus's lower storey as a ghost. Where along the section each lies
is not published, so positions along it are look choices in LOOK; depths are the records'.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import data, hawara as W, renderer  # noqa: E402
from giza.diagram import box, clear, material, mesh, polyline  # noqa: E402

REPO = os.path.dirname(HERE)
VEX = 4.0
LOOK = dict(
    south_foot=35.0,        # how far south of the pyramid the deep chips run, before thinning to 2-4 ft
    closures=((-95.0, "shallow"), (-125.0, "deep"), (-140.0, "deep")),   # y of each closure's centre
    closure_height=2.5,     # each closure's height; the paper gives width and depth only
    walls_every=24.0,       # spacing of the Mataha walls drawn along the section
    wall_thickness=3.0,     # "several metres thick"
    storey=(1.2, 7.0),      # the ghost of Herodotus's lower storey, top and bottom depth: no source gives one
)


def rec():
    return {r["key"]: float(r["value"]) for r in data.records("hawara.json")}


def build(coll):
    r, f = rec(), W.figures()
    half = f["side"] / 2
    y_n, y_s = -half, -half - f["bed_width"]                 # the chip bed's north and south edges, pyramid at y = 0
    x0, x1 = -6.0, 6.0
    z = lambda d: -d * VEX  # noqa: E731   depth below ground to drawn z
    M = dict(
        stone=material("pyramid", (0.80, 0.72, 0.58)),
        chips=material("chips (excavated)", (0.88, 0.84, 0.74), rough=0.95),
        soil=material("sediment and mudstone", (0.42, 0.33, 0.24), rough=1.0),
        rock=material("limestone (instrumented)", (0.62, 0.62, 0.60), rough=0.9),
        water=material("water table (instrumented)", (0.20, 0.45, 0.95), alpha=0.12, emit=0.3),
        waterline=material("water line", (0.35, 0.60, 1.0), emit=2.5),
        closure=material("closure (instrumented)", (0.10, 0.12, 0.16), rough=0.9),
        claimed=material("claimed outline", (1.0, 0.45, 0.08), emit=2.0, dashes=2.0, alpha=1.0),
        ghost=material("legendary", (0.95, 0.95, 1.0), emit=0.9, dashes=1.5, alpha=0.6),
    )
    # The ground under the section, from the pyramid's centre south past the chip bed.
    ys, ye = 30.0, y_s - 40.0
    box("sediment", x0, x1, ye, ys, z(r["hawara.limestone.depth.min"]), 0.0, M["soil"], coll)
    box("limestone", x0, x1, ye, ys, z(22.0), z(r["hawara.limestone.depth.min"]), M["rock"], coll)
    polyline("limestone, deepest top", [(x1 + 0.5, ye, z(r["hawara.limestone.depth.max"])), (x1 + 0.5, ys, z(r["hawara.limestone.depth.max"]))], 0.25, M["rock"], coll)
    # Petrie's chips: deep along the pyramid's south foot, thin beyond.
    deep = r["hawara.labyrinth.chips.depth.south_foot.max"]
    thin = r["hawara.labyrinth.chips.depth.elsewhere.max"]
    box("chips at the south foot", x0 + 0.1, x1 + 0.1, y_n - LOOK["south_foot"], y_n, z(deep), 0.15, M["chips"], coll)
    box("chips elsewhere", x0 + 0.1, x1 + 0.1, y_s, y_n - LOOK["south_foot"], z(thin), 0.15, M["chips"], coll)
    # The pyramid's south foot, drawn to its own scale (not exaggerated), cut by the frame.
    H = f["height"]
    mesh("Hawara pyramid", [(x1 + 0.05, -half, 0.0), (x1 + 0.05, half, 0.0), (x1 + 0.05, 0.0, H)], [(0, 1, 2)], M["stone"], coll)
    # The water table: a band between its shallowest and deepest across the site.
    wmin, wmax = r["hawara.watertable.depth.min"], r["hawara.watertable.depth.max"]
    box("water table range", x1 + 0.3, x1 + 0.4, ye, ys, z(wmax), z(wmin), M["water"], coll)
    for d in (wmin, wmax):
        polyline("water line %g m" % d, [(x1 + 0.6, ye, z(d)), (x1 + 0.6, ys, z(d))], 0.3, M["waterline"], coll)
    # Elshazly's closures, at their depths, each its width wide.
    for y, which in LOOK["closures"]:
        d, w = r["hawara.ert.closure.%s.depth" % which], r["hawara.ert.closure.%s.width" % which]
        hh = LOOK["closure_height"] / 2
        box("closure %s at %g m" % (which, d), x1 + 0.7, x1 + 1.2, y - w / 2, y + w / 2, z(d + hh), z(d - hh), M["closure"], coll)
    # The Mataha walls, as claimed: dashed outlines between 8 and 12 m.
    a, b = r["hawara.mataha.walls.depth.min"], r["hawara.mataha.walls.depth.max"]
    y = y_n - 20.0
    while y > y_s + 10.0:
        t = LOOK["wall_thickness"] / 2
        polyline("Mataha wall at %d" % y, [(x1 + 1.4, y - t, z(a)), (x1 + 1.4, y + t, z(a)), (x1 + 1.4, y + t, z(b)), (x1 + 1.4, y - t, z(b))], 0.35, M["claimed"], coll, closed=True)
        y -= LOOK["walls_every"]
    # Herodotus's lower storey: a ghost under the whole bed, depth a look choice.
    s0, s1 = LOOK["storey"]
    polyline("Herodotus's lower storey (legendary)", [(x1 + 1.7, y_s, z(s0)), (x1 + 1.7, y_n, z(s0)), (x1 + 1.7, y_n, z(s1)), (x1 + 1.7, y_s, z(s1))], 0.3, M["ghost"], coll, closed=True)
    return dict(y_n=y_n, y_s=y_s, ys=ys, ye=ye)


def main():
    o = {}
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for k, v in zip(argv[::2], argv[1::2]):
        o[k.lstrip("-")] = v
    w, hgt = (int(x) for x in o.get("size", "1600x900").split("x"))
    samples = int(o.get("samples", 24))
    out = o.get("out", os.path.join(REPO, "build", "preview", "hawara-section.png"))
    clear()
    scene = bpy.context.scene
    coll = bpy.data.collections.new("hawara section")
    scene.collection.children.link(coll)
    span = build(coll)
    cam_data = bpy.data.cameras.new("camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = (span["ys"] - span["ye"]) * 1.02
    cam = bpy.data.objects.new("camera", cam_data)
    cy = (span["ys"] + span["ye"]) / 2
    cam.location = Vector((400.0, cy, -20.0))
    cam.rotation_euler = (Vector((0.0, cy, -20.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 2.5
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (Vector((-1.0, 0.3, -0.6))).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    world = scene.world or bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.05, 0.06, 0.08, 1)
    renderer.gpu(scene)
    renderer.configure(scene, exposure=0.0)
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = w, hgt
    scene.view_settings.exposure = 0.0
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump(dict(render=os.path.relpath(out, REPO), vertical_exaggeration=VEX, look_choices=LOOK, span=span,
                       note="North is to the right; seen from the east. Depths from data/measurements/hawara.json."), fh, indent=2)
    print("wrote", out)


main()
