"""
Chapter 7's Enclosure D, a labelled stand-in from its plan (render/giza/enclosure_d.py), at eye height.

    blender -b --factory-startup -P render/enclosure_d.py -- --size 1600x900 --samples 32 [--view rim|south|air|orbit:T] [--fill level|slide] [--level M]

`rim` stands outside the ring on the south, a person's eye height above the wall's preserved top, where a
visitor sees it from; `south` stands on the floor inside the ring, south of the central pair, at eye height,
looking north; `orbit:T` is the sequence's camera a share T of the way round the rim (giza.enclosure_d.orbit);
`air` looks down from the south-west so the ring's plan reads. A human figure, LOOK["figure"] tall,
stands by the western central pillar for scale. The JSON beside the PNG says it is a stand-in and lists the
look choices. Nothing is carved on the pillars: no measured drawing of their relief has been read.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import enclosure_d as E, renderer  # noqa: E402
from giza.diagram import clear, cylinder, material, mesh  # noqa: E402

REPO = os.path.dirname(HERE)
VIEWS = dict(
    rim=dict(eye=(-2.0, -10.5, 4.6), at=(0.0, -0.5, 1.6), lens=22),
    south=dict(eye=(0.0, -5.2, 1.6), at=(0.0, 0.0, 2.6), lens=24),
    air=dict(eye=(-14.0, -17.0, 14.0), at=(0.0, -1.8, 0.5), lens=30),
)


def build(coll, fill=None, level=None):
    rec = E.records()
    if os.path.exists(os.path.join(REPO, "build", "textures", "index.json")):
        # the Giza scene's own stone: CC0 photographed grain (python scripts/textures.py), toned by noise; the flat
        # faces take a soft bump, since the 8-bit displacement maps terrace into rings under a strong one
        from giza import materials as S
        M = dict(
            stone=S.stone("limestone pillars (stand-in)", "tura_dressed", tex_role="casing", instanced=False, sand_tops=0.3),
            wall=S.stone("rubble wall (stand-in)", "mastaba_core", tex_role="core", instanced=False, sand_tops=0.5, bump=0.1),
            floor=S.stone("bedrock floor", "core", tex_role="bedrock", instanced=False, sand_tops=0.6, bump=0.1),
            hill=S.stone("the mound's surface", "core", tex_role="sand", instanced=False, sand_tops=0.9, bump=0.12),
        )
    else:
        M = dict(
            stone=material("limestone pillars (stand-in)", (0.62, 0.55, 0.45), rough=0.9),
            wall=material("rubble wall (stand-in)", (0.36, 0.31, 0.25), rough=0.95),
            floor=material("bedrock floor", (0.48, 0.42, 0.34), rough=0.95),
            hill=material("the mound's surface", (0.50, 0.43, 0.33), rough=1.0),
        )
    M["figure"] = material("figure for scale", (0.18, 0.24, 0.34), rough=0.7)
    if "hill" in M and os.path.exists(os.path.join(REPO, "build", "textures", "index.json")):
        M["fill"] = S.stone("fill: rubble and settlement debris", "mastaba_core", tex_role="sand", instanced=False,
                            sand_tops=0.3, bump=0.1)
    else:
        M["fill"] = material("fill: rubble and settlement debris", (0.30, 0.25, 0.19), rough=1.0)
    mesh("floor", [(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [(0, 1, 2, 3)], M["floor"], coll)
    w = E.wall(rec)
    vs, fs = E.wall_mesh(w)
    mesh("wall", vs, fs, M["wall"], coll)
    vs, fs = E.ground_mesh(w)
    mesh("the hill round it", vs, fs, M["hill"], coll)
    level = E.LOOK["fill_level"] if level is None else level
    if fill and level > 0:   # the fill sequence starts from the empty enclosure
        vs, fs = E.fill_mesh(w, level, fill)
        mesh("fill (%s)" % fill, vs, fs, M["fill"], coll)
    for p in E.pillars(rec):
        for k, (pv, pf) in enumerate(E.tpillar(p)):
            mesh("%s %d" % (p["name"], k), pv, pf, M["stone"], coll)
    # the figure, by the western central pillar, on the floor, or on a level fill's surface, so it is not buried as the fill rises
    west = E.pillars(rec)[0]
    fx, fy, h = west["x"] + 0.9, west["y"] - 1.6, E.LOOK["figure"]
    dz = level if fill == "level" else 0.0
    for k, (x, y, r, z0, z1) in enumerate(E.figure_parts(fx, fy, h)):
        cylinder("figure %d" % k, x, y, r, z0 + dz, z1 + dz, M["figure"], coll, n=16)
    return dict(figure=(fx, fy, h))


def main():
    o = {}
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for k, v in zip(argv[::2], argv[1::2]):
        o[k.lstrip("-")] = v
    w, hgt = (int(x) for x in o.get("size", "1600x900").split("x"))
    samples = int(o.get("samples", 32))
    view = o.get("view", "rim")
    out = o.get("out", os.path.join(REPO, "build", "preview", "enclosure-d-%s.png" % view))
    clear()
    scene = bpy.context.scene
    coll = bpy.data.collections.new("enclosure D")
    scene.collection.children.link(coll)
    fill = o.get("fill")             # level (Schmidt's backfill) or slide (Clare's slope slides)
    level = float(o["level"]) if "level" in o else None   # metres above the floor, for the fill rising frame by frame
    placed = build(coll, fill, level)
    if view.startswith("orbit"):   # orbit:T, the sequence's camera a share T of the way round
        v = dict(E.orbit(float(view.split(":")[1])), lens=22)
        out = o.get("out", os.path.join(REPO, "build", "preview", "enclosure-d-orbit-%s.png" % view.split(":")[1]))
    else:
        v = VIEWS[view]
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = v["lens"]
    cam = bpy.data.objects.new("camera", cam_data)
    cam.location = Vector(v["eye"])
    cam.rotation_euler = (Vector(v["at"]) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    # a low morning sun from the south-east, about 16 degrees up, so the pillars' broad faces and the wall's curve read
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 3.0
    sun_data.angle = math.radians(1.0)
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = Vector((-0.55, 0.75, -0.30)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    world = scene.world or bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.42, 0.55, 0.75, 1)
    bg.inputs["Strength"].default_value = 0.5
    renderer.gpu(scene)
    renderer.configure(scene, exposure=0.0)
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = w, hgt
    scene.view_settings.exposure = float(o.get("exposure", 0.0))
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump(dict(render=os.path.relpath(out, REPO), view=view, camera=v, stand_in=True, look_choices=E.LOOK, fill=fill,
                       fill_level=E.LOOK["fill_level"] if level is None else level,
                       figure=placed["figure"],
                       note="A stand-in for Enclosure D at Göbekli Tepe. Pillar positions, widths and the central pair's "
                            "axes are scaled from Haklay & Gopher 2020 Fig. 1; the central pillars' height, their pedestals "
                            "and the wall's preserved height are printed on its p. 347 (data/measurements/gobekli.json). "
                            "The rest is look choices; no relief is carved."), fh, indent=2)
    print("wrote", out)


main()
