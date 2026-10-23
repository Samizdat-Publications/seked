"""
The Labyrinth at Hawara, built as one reconstruction draws it (render/giza/labyrinth.py), on Petrie's chip bed south
of Amenemhat III's pyramid. A legendary-tier picture: nobody has found it, and nothing of its form is a measurement.

    blender -b --factory-startup -P render/hawara_labyrinth.py -- [--view air|avenue|court|maze|under|all]
        [--roof on|off] [--size 1600x900] [--samples 64] [--out DIR]

The pyramid is Petrie's, cased (render/giza/hawara.py figures: his brick base and casing, his 48 deg 45 min). The
ground is flat desert (no heightfield of Hawara yet), the light a low afternoon sun, both look choices. The roofs are
left off by default so the plan reads from above; Herodotus says every room was roofed in stone (`--roof on`).
`under` shows the legendary lower storey, Herodotus's 1,500 rooms below the ground that he was not shown, ghosted
in a pit dug through the courts east of the avenue (the cut is a device to show it), at the depths the 2008 expedition's organiser gives for the walls it reports
(8 to 12 m, a claim). Frame: the Hawara pyramid's base centre, x east, y north, z up, metres.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from giza import hawara as W, labyrinth as LB  # noqa: E402
from giza.instancing import field  # noqa: E402
from giza.materials import TEX, coursed_casing, image  # noqa: E402

SUN = {"altitude": 22.0, "azimuth": 245.0}      # a low afternoon sun from the south-west (look choice)
EXPOSURE = -1.0


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return dict(zip(argv[::2], argv[1::2]))


def textured(name, role, tint, scale=1.0, bump=0.4, rough=0.85, alpha=1.0):
    """A CC0 photograph (blender/textures.json role) box-projected at its size times `scale`, its light and dark kept
    over `tint`; with alpha below 1, see-through."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    co = N.new("ShaderNodeTexCoord").outputs["Object"]
    mp = N.new("ShaderNodeMapping")
    t = TEX[role]["tile_m"][0] * scale
    mp.inputs["Scale"].default_value = (1 / t,) * 3
    L.new(co, mp.inputs["Vector"])
    di = N.new("ShaderNodeTexImage"); di.image, di.projection, di.projection_blend = image(role, "Diffuse"), "BOX", 0.25
    hm = N.new("ShaderNodeTexImage"); hm.image, hm.projection, hm.projection_blend = image(role, "Displacement", True), "BOX", 0.25
    L.new(mp.outputs[0], di.inputs["Vector"]); L.new(mp.outputs[0], hm.inputs["Vector"])
    bw = N.new("ShaderNodeRGBToBW"); L.new(di.outputs["Color"], bw.inputs[0])
    rng = N.new("ShaderNodeMapRange")
    rng.inputs[1].default_value, rng.inputs[2].default_value = 0.0, 0.6
    rng.inputs[3].default_value, rng.inputs[4].default_value = 0.6, 1.2
    L.new(bw.outputs[0], rng.inputs[0])
    grey = N.new("ShaderNodeCombineColor")
    for k in range(3):
        L.new(rng.outputs[0], grey.inputs[k])
    mix = N.new("ShaderNodeMix"); mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    mix.inputs[6].default_value = tint
    L.new(grey.outputs[0], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs["Base Color"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.03
    L.new(hm.outputs["Color"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
    return m


def ghost(name, colour=(1.0, 0.80, 0.50), strength=1.6, alpha=0.45):
    """The legendary tier's look: pale, glowing a little, half there."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1.0)
    b.inputs["Emission Color"].default_value = (*colour, 1.0)
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Alpha"].default_value = alpha
    return m


def mesh_object(name, verts, faces, mat, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.asarray(verts).tolist(), [], np.asarray(faces).tolist())
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def column_variant(h, r, mat):
    """One column, a metre being 1: a shaft and a square abacus, as a mesh."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * 0.9, depth=h - 0.5)
    bmesh.ops.translate(bm, vec=(0, 0, (h - 0.5) / 2), verts=bm.verts)
    ab = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(2.6 * r, 2.6 * r, 0.5), verts=ab["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, h - 0.25), verts=ab["verts"])
    me = bpy.data.meshes.new("column")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    me.shade_smooth()
    lib = bpy.data.collections.new("column variants")
    lib.objects.link(bpy.data.objects.new("column", me))
    return lib


def pyramid(f, mat, coll):
    p = W.at_hawara(f)["pyramid"]
    h, H = p["half"], p["H"]
    v = [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0), (0, 0, H)]
    fs = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)]
    me = bpy.data.meshes.new("Amenemhat III's pyramid, cased")
    me.from_pydata(v, [], fs)
    me.materials.append(mat)
    ob = bpy.data.objects.new(me.name, me)
    coll.objects.link(ob)
    return p


def build(sc, roof=False, under=False):
    f = W.figures()
    P = LB.plan(f)
    coll = sc.collection
    M = dict(
        stone=textured("limestone (stand-in)", "core", (0.74, 0.62, 0.46, 1.0), scale=0.8, bump=0.3),
        # dressed limestone in courses about a metre high, as the Middle Kingdom built in Tura stone (look choice)
        wall=coursed_casing("limestone walls (stand-in)", colours=("b59a76", "c9b08a"), rough=0.7, course=1.05,
                            width=1.9, mortar=0.012, tone=0.10, line=0.35, mottle=0.25),
        chapel=textured("granite chapels (stand-in)", "granite", (0.42, 0.26, 0.22, 1.0), scale=1.0, bump=0.3),
        floor=textured("paving", "casing", (0.66, 0.55, 0.41, 1.0), scale=2.0, bump=0.15),
        earth=textured("the ground, cut", "bedrock", (0.55, 0.43, 0.30, 1.0), scale=4.0, bump=0.4),
        casing=textured("Hawara pyramid casing", "casing", (0.80, 0.72, 0.58, 1.0), scale=3.0, bump=0.1, rough=0.6),
        sand=textured("Fayum desert", "sand", (0.62, 0.45, 0.28, 1.0), scale=6.0, bump=0.2, rough=0.95),
        ghost=ghost("the lower storey (legendary)"),
    )
    # with `under`, a pit dug through the courts east of the avenue, down past the lower storey, so it shows
    F = P["frame"]
    x0, x1, y0, y1 = F["bed"]
    lift = 0.6
    pit = None
    if under:
        av = float((F["X"](LB.PLAN["avenue"][0]) + F["X"](LB.PLAN["avenue"][1])) / 2)
        i = LB.PLAN["inner"]
        pit = (av + 3.0, float(F["X"](i[1])) - 2.0, float(F["Y"](i[3])) + 2.0, float(F["Y"](i[2])) - 2.0)
    inside = (lambda bx: pit is not None and pit[0] < (bx[0] + bx[1]) / 2 < pit[1] and pit[2] < (bx[2] + bx[3]) / 2 < pit[3])
    # the desert, and Petrie's foundation platform on the chip bed, both round the pit if there is one
    R = 6000.0
    if pit is None:
        mesh_object("Fayum desert (look choice)", [(-R, -R, 0), (R, -R, 0), (R, R, 0), (-R, R, 0)], [(0, 1, 2, 3)], M["sand"], coll)
        v, fc = LB.boxes_mesh([(x0, x1, y0, y1, 0.0, lift)])
    else:
        px0, px1, py0, py1 = pit
        v = [(-R, -R, 0), (R, -R, 0), (R, R, 0), (-R, R, 0), (px0, py0, 0), (px1, py0, 0), (px1, py1, 0), (px0, py1, 0)]
        mesh_object("Fayum desert (look choice)", v, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], M["sand"], coll)
        v, fc = LB.boxes_mesh([(x0, px0, y0, y1, 0.0, lift), (px1, x1, y0, y1, 0.0, lift),
                               (px0, px1, y0, py0, 0.0, lift), (px0, px1, py1, y1, 0.0, lift)])
        zb = LB.LOOK["lower"][0] - 0.8
        e = [(px0, py0, lift), (px1, py0, lift), (px1, py1, lift), (px0, py1, lift),
             (px0, py0, zb), (px1, py0, zb), (px1, py1, zb), (px0, py1, zb)]
        mesh_object("the pit's sides and floor (a cut to show the lower storey)", e,
                    [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)], M["earth"], coll)
    mesh_object("the foundation platform (Petrie's chip bed)", v, fc, M["floor"], coll)
    # walls and chapels on the platform
    boxes = [(b[0], b[1], b[2], b[3], b[4] + lift, b[5] + lift) for b in (w["box"] for w in P["walls"]) if not inside(b)]
    v, fc = LB.boxes_mesh(boxes)
    mesh_object("the Labyrinth's walls (reconstruction)", v, fc, M["wall"], coll)
    v, fc = LB.boxes_mesh([(c[0], c[1], c[2], c[3], c[4] + lift, c[5] + lift) for c in P["chapels"] if not inside(c)])
    mesh_object("the chapels (reconstruction)", v, fc, M["chapel"], coll)
    # columns, as instances
    L = LB.LOOK
    lib = column_variant(L["column_h"], L["column_r"], M["stone"])
    C = np.asarray([c for c in P["columns"] if not inside((c[0], c[0], c[1], c[1]))])
    n = len(C)
    field("columns", lib, np.c_[C, np.full(n, lift)], np.zeros((n, 3)), np.ones((n, 3)), np.zeros(n, int),
          np.zeros(n), np.zeros(n), coll)
    if roof:
        rb = []
        for c in P["courts"]:
            cx0, cx1, cy0, cy1 = c["box"]
            rb.append((cx0, cx1, cy0, cy1, lift + L["room_h"], lift + L["room_h"] + 0.8))
        v, fc = LB.boxes_mesh(rb)
        mesh_object("roofs (Herodotus: all of stone)", v, fc, M["stone"], coll)
    if under:
        z0, z1 = L["lower"]
        kinds = ("court", "room")
        lb = [(b[0], b[1], b[2], b[3], z0, z1) for b in (w["box"] for w in P["walls"] if w["kind"] in kinds) if inside(b)]
        lb += [(c[0], c[1], c[2], c[3], z0, z1) for c in P["chapels"] if inside(c)]
        v, fc = LB.boxes_mesh(lb)
        mesh_object("the lower storey (legendary)", v, fc, M["ghost"], coll)
    pyr = pyramid(f, M["casing"], coll)
    return P, pyr


def world_and_sun(sc):
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    nt = w.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(SUN["altitude"])
    sky.sun_rotation = math.radians(SUN["azimuth"])
    sky.sun_disc = False
    nt.links.new(sky.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 0.10
    sc.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy, sun.data.angle, sun.data.color = 3.4, math.radians(0.53), (1.0, 0.9, 0.76)
    e, a = math.radians(SUN["altitude"]), math.radians(SUN["azimuth"])
    to_sun = Vector((math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sun)


def views(P, pyr):
    F = P["frame"]
    x0, x1, y0, y1 = F["bed"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    av = float((F["X"](LB.PLAN["avenue"][0]) + F["X"](LB.PLAN["avenue"][1])) / 2)
    court = P["courts"][4]                         # a western court in the middle rows
    cb = court["box"]
    o, i = LB.PLAN["outer"], LB.PLAN["inner"]
    # the meander's corridor runs between its teeth: stand in the gap between the first two along the north side
    P_ = LB.PLAN["key_period"]
    maze_x = float(F["X"](i[0] + P_ / 4 + P_ / 4))
    maze_y = float(F["Y"]((o[2] + LB.PLAN["outer_thick"] + i[2]) / 2))
    eye = 1.7 + 0.6
    return {
        # from the air, south-east, the whole Labyrinth with the pyramid beyond it
        "air": (Vector((cx + 260, y0 - 300, 260)), Vector((cx, cy + 10, 0)), 32),
        # in the avenue just inside the south gate, looking north to the pyramid
        "avenue": (Vector((av, y0 + 18, eye)), Vector((av, pyr["cy"], 25)), 28),
        # in a court's hall, among its columns, looking west to its chapels
        "court": (Vector((cb[1] - 8, (cb[2] + cb[3]) / 2, eye)), Vector((cb[0], (cb[2] + cb[3]) / 2, 3.5)), 22),
        # in the meander along the north side, looking east down its turns
        "maze": (Vector((maze_x, float(F["Y"](i[2])) + 1.5, eye)), Vector((maze_x + 4, float(F["Y"](o[2])), 3.0)), 20),
        # the lower storey, ghosted in a pit dug through the eastern courts
        "under": (Vector((cx + 190, y0 - 150, 120)), Vector((cx + 60, cy, -10)), 30),
    }


def main():
    a = args()
    out = os.path.abspath(a.get("--out", os.path.join(REPO, "build", "hawara", "render")))
    os.makedirs(out, exist_ok=True)
    w, h = (int(v) for v in a.get("--size", "1600x900").split("x"))
    which = a.get("--view", "all")
    names = ["air", "avenue", "court", "maze", "under"] if which == "all" else which.split(",")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    world_and_sun(sc)
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = dev.type != "CPU"
    sc.cycles.samples = int(a.get("--samples", 64))
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.view_settings.exposure = float(a.get("--exposure", EXPOSURE))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.clip_end = 20000
    built = {}
    for under in (False, True):
        group = [n for n in names if (n == "under") == under]
        if not group:
            continue
        for o in list(sc.collection.objects):
            if o not in (cam,) and o.type != "LIGHT":
                bpy.data.objects.remove(o, do_unlink=True)
        P, pyr = build(sc, roof=a.get("--roof", "off") == "on", under=under)
        V = views(P, pyr)
        for name in group:
            pos, tgt, lens = V[name]
            cam.location = pos
            cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
            cam.data.lens = lens
            sc.render.filepath = os.path.join(out, f"labyrinth-{name}.png")
            bpy.ops.render.render(write_still=True)
            print("wrote", sc.render.filepath, flush=True)
        built = dict(courts=len(P["courts"]), rooms=sum(c["rooms"] for c in P["courts"]), columns=len(P["columns"]))
    json.dump(dict(built=built, look=LB.LOOK, sun=SUN, tier="legendary", stand_in=True,
                   note="A reconstruction after the Mataha report's cover plan (after Kircher, unconfirmed), stretched "
                        "onto Petrie's chip bed. Nobody has found the Labyrinth; nothing of its form is a measurement."),
              open(os.path.join(out, "labyrinth.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
