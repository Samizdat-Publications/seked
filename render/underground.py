"""
Chapter 8's cutaway: Khafre's pyramid and the plateau cut on a north-south plane through its axis,
the known rooms in stone, the Khafre Project's claimed wells, spirals, cubes and Zeds in the claimed
tier's look, and Khafre's height laid end to end down the depth for scale.

    blender -b --factory-startup -P render/underground.py -- --shot depth --size 1600x900 --samples 32
    blender -b --factory-startup -P render/underground.py -- --shot base
    blender -b --factory-startup -P render/underground.py -- --shot depth --reply 1     # the reply's three lines

The west half is cut away and the camera looks east at the section, so the burial chamber (east of the
axis) shows through the cut face. The rock and the cut faces are drawn half transparent, as an x-ray:
it is a diagram of a claim, not a view anyone could have. Every figure comes from
render/giza/underground.py, which reads data/; its LOOK table is the stated look choices. Writes the
PNG and, beside it, a JSON with the camera, the receipts and the look choices, so the page can
register its labels on the picture.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import renderer, underground as U  # noqa: E402

REPO = os.path.dirname(HERE)
DEPTH_BELOW = 780.0          # how far the rock block runs under Khafre's base (the cubes end at 728)
HALF_SPAN = 420.0            # the block's half-width north-south
EAST = 240.0                 # how far it runs east of the cut: past the east row and its cube


def parse(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    o = {}
    it = iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it)
    return o


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for b in list(coll):
            coll.remove(b)


def material(name, rgb, alpha=1.0, emit=0.0, rough=0.85, strata=False, dashes=0.0):
    """A Principled or emission surface, mixed with transparency for the x-ray; `dashes` bands it in z."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emit > 0:
        surf = nt.nodes.new("ShaderNodeEmission")
        surf.inputs["Color"].default_value = (*rgb, 1)
        surf.inputs["Strength"].default_value = emit
    else:
        surf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        surf.inputs["Base Color"].default_value = (*rgb, 1)
        surf.inputs["Roughness"].default_value = rough
        if strata:
            # bedding in the limestone: alternating tones every ten metres or so (a look choice)
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            wave = nt.nodes.new("ShaderNodeTexWave")
            wave.wave_type = "BANDS"
            wave.bands_direction = "Z"
            wave.inputs["Scale"].default_value = 0.004
            wave.inputs["Distortion"].default_value = 2.0
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].color = (rgb[0] * 0.78, rgb[1] * 0.76, rgb[2] * 0.72, 1)
            ramp.color_ramp.elements[1].color = (*rgb, 1)
            nt.links.new(geo.outputs["Position"], wave.inputs["Vector"])
            nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
            nt.links.new(ramp.outputs["Color"], surf.inputs["Base Color"])
            del sep
    shader = surf
    if alpha < 1.0 or dashes > 0:
        clear_ = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        fac = alpha
        if dashes > 0:
            # dashes along every edge: the claimed tier's outline, drawn and gapped every `dashes` metres
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            mod = nt.nodes.new("ShaderNodeMath")
            mod.operation = "PINGPONG"
            mod.inputs[1].default_value = dashes / 2
            cmp_ = nt.nodes.new("ShaderNodeMath")
            cmp_.operation = "GREATER_THAN"
            cmp_.inputs[1].default_value = dashes / 4
            mul = nt.nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = alpha
            add = nt.nodes.new("ShaderNodeVectorMath")
            add.operation = "DOT_PRODUCT"
            add.inputs[1].default_value = (1.0, 1.0, 1.0)
            nt.links.new(geo.outputs["Position"], add.inputs[0])
            nt.links.new(add.outputs["Value"], mod.inputs[0])
            del sep
            nt.links.new(mod.outputs[0], cmp_.inputs[0])
            nt.links.new(cmp_.outputs[0], mul.inputs[0])
            nt.links.new(mul.outputs[0], mix.inputs["Fac"])
        else:
            mix.inputs["Fac"].default_value = fac
        nt.links.new(clear_.outputs[0], mix.inputs[1])
        nt.links.new(surf.outputs[0], mix.inputs[2])
        shader = mix
    nt.links.new(shader.outputs[0], out.inputs["Surface"])
    return m


def mesh(name, verts, faces, mat, coll, face_mats=None, mats=()):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.materials.append(mat)
    for extra in mats:
        me.materials.append(extra)
    if face_mats:
        for poly, mi in zip(me.polygons, face_mats):
            poly.material_index = mi
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, mat, coll):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh(name, v, f, mat, coll)


def polyline(name, pts, radius, mat, coll, closed=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (float(q[0]), float(q[1]), float(q[2]), 1.0)
    sp.use_cyclic_u = closed
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    coll.objects.link(ob)
    return ob


def cylinder(name, x, y, r, z0, z1, mat, coll, n=32):
    v, f = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        v += [(x + r * math.cos(a), y + r * math.sin(a), z0), (x + r * math.cos(a), y + r * math.sin(a), z1)]
    for i in range(n):
        j = (i + 1) % n
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    return mesh(name, v, f, mat, coll)


def build(coll, cut_only=False, reply=False):
    k, c = U.khafre(), U.claim()
    cx, cy, b, h, H = k["cx"], k["cy"], k["base"], k["side"] / 2, k["H"]
    M = dict(
        rock=material("rock (x-ray)", (0.62, 0.52, 0.38), alpha=0.30, strata=True),
        ground=material("ground", (0.80, 0.68, 0.50), alpha=0.85, rough=0.95),
        cut=material("section face", (0.70, 0.60, 0.45), alpha=0.20, strata=True),
        stone=material("pyramid limestone", (0.80, 0.72, 0.58), rough=0.8),
        pcut=material("pyramid section", (0.86, 0.80, 0.68), alpha=0.4, rough=0.9),
        known=material("excavated", (0.10, 0.09, 0.08), rough=0.9),
        shell=material("claimed shell", (1.0, 0.52, 0.12), alpha=0.28, emit=0.9),
        path=material("claimed spiral", (1.0, 0.45, 0.08), emit=1.3),
        edge=material("claimed edges", (1.0, 0.52, 0.12), emit=1.8, dashes=8.0, alpha=1.0),
        scale=material("scale", (0.92, 0.95, 1.0), emit=2.5),
        outline=material("excavated outline", (0.95, 0.90, 0.78), emit=1.2),
        radar=material("reply: radar's reach", (0.80, 0.92, 1.0), emit=2.5),
        water=material("reply: water table", (0.20, 0.50, 1.0), emit=2.5),
        claim=material("reply: the claim's depth", (1.0, 0.45, 0.08), emit=2.5),
    )
    # The rock east of the cut, from Khafre's base down: its top is ground, its west face the section.
    x0, x1, y0, y1, z0, z1 = cx, cx + EAST, cy - HALF_SPAN, cy + HALF_SPAN, b - DEPTH_BELOW, b
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh("plateau, cut", v, f, M["rock"], coll, face_mats=[0, 1, 0, 0, 0, 2], mats=(M["ground"], M["cut"]))
    # Khafre's eastern half: the west face is the section through the axis.
    v = [(cx, cy - h, b), (cx + h, cy - h, b), (cx + h, cy + h, b), (cx, cy + h, b), (cx, cy, b + H)]
    f = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)]
    mesh("Khafre, cut", v, f, M["stone"], coll, face_mats=[0, 0, 0, 1, 0], mats=(M["pcut"],))
    # The known rooms, solid and dark: a hairline at this scale.
    rooms = U.known_rooms(k)
    known = [box("burial chamber", *rooms["chamber"], M["known"], coll),
             box("horizontal passage", *rooms["horizontal"], M["known"], coll)]
    d = rooms["descending"]
    s, e, w2, hh = Vector(d["start"]), Vector(d["end"]), d["width"] / 2, d["height"]
    v = [(s.x - w2, s.y, s.z), (s.x + w2, s.y, s.z), (e.x + w2, e.y, e.z), (e.x - w2, e.y, e.z)]
    v += [(p[0], p[1], p[2] + hh) for p in v]
    known.append(mesh("descending passage", v, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], M["known"], coll))
    for ob in known:
        # a light edge round each excavated room, so the dark stone reads through the x-ray
        wire = ob.modifiers.new("outline", "WIREFRAME")
        wire.thickness = 0.15
        wire.use_replace = False
        ob.data.materials.append(M["outline"])
        wire.material_offset = 1
    # The claim, in the claimed tier's look: dashed shells, bright spirals, dashed edges.
    for i, w in enumerate(U.wells(c, k)):
        if cut_only and w["x"] < cx:
            continue
        cylinder("well %d" % (i + 1), w["x"], w["y"], w["radius"], w["bottom"], w["top"], M["shell"], coll)
        polyline("spiral %d" % (i + 1), U.helix(w), U.LOOK["spiral_width"] / 2, M["path"], coll)
    for i, q in enumerate(U.cubes(c, k)):
        if cut_only and q["x"] < cx:
            continue
        s2 = q["side"] / 2
        cube = box("cube %d" % (i + 1), q["x"] - s2, q["x"] + s2, q["y"] - s2, q["y"] + s2, q["z"] - s2, q["z"] + s2, M["shell"], coll)
        wire = cube.modifiers.new("edges", "WIREFRAME")
        wire.thickness = 1.2
        wire.use_replace = False
        cube.data.materials.append(M["edge"])
        wire.material_offset = 1
    for i, zd in enumerate(U.zeds(c, k)):
        for j, lv in enumerate(zd["levels"]):
            box("zed %d level %d" % (i + 1, j + 1), *lv, M["shell"], coll)
    # Khafre's height laid end to end down the claimed depth, in the plane of the cut, north of the pyramid.
    ya, yb = cy + h + 25.0, cy + h + 25.0 + 2 * h
    for i, (top, bot, frac) in enumerate(U.stack(-c["bottom"], H)):
        apex, base_z = b + top, b + top - H
        if frac >= 1.0:
            pts = [(cx - 0.6, ya, base_z), (cx - 0.6, yb, base_z), (cx - 0.6, (ya + yb) / 2, apex)]
        else:
            # the part of a Khafre that is left: its top `frac` of the height, as a truncated triangle
            zc = b + bot
            t = (apex - zc) / H
            hw = h * t
            pts = [(cx - 0.6, (ya + yb) / 2 - hw, zc), (cx - 0.6, (ya + yb) / 2 + hw, zc), (cx - 0.6, (ya + yb) / 2, apex)]
        polyline("Khafre height %d" % (i + 1), pts, 0.9, M["scale"], coll, closed=True)
    if reply:
        # The reply's three lines across the cut: radar's reach by the claimant's own figure, the water table, the claim.
        for name, z in U.reply_levels(c, k).items():
            polyline("reply " + name, [(cx - 1.0, cy - HALF_SPAN, z), (cx - 1.0, cy + HALF_SPAN, z)], 1.6, M[name], coll)
    return k, c


# The two views: the whole depth, and the base, where the known rooms and the tops of the wells are.
SHOTS = {
    "depth": dict(target=(40.0, 40.0, -330.0), location=(-2150.0, -1250.0, 300.0)),
    # an elevation of the section, as an architect draws one: orthographic, from due west, and showing only
    # what lies behind the cut (the west row stands in the removed half)
    "base": dict(target=(0.0, 42.0, 14.0), location=(-900.0, 42.0, 40.0), ortho=150.0, cut_only=True),
}


def camera_and_light(k, size, shot="depth"):
    cx, cy, b = k["cx"], k["cy"], k["base"]
    s = SHOTS[shot]
    target = Vector((cx + s["target"][0], cy + s["target"][1], b + s["target"][2]))
    loc = Vector((cx + s["location"][0], cy + s["location"][1], b + s["location"][2]))
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = 50.0
    if "ortho" in s:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = s["ortho"]
    cam_data.clip_end = 20000.0
    cam = bpy.data.objects.new("camera", cam_data)
    cam.location = loc
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(1.0)
    sun = bpy.data.objects.new("sun", sun_data)
    az, el = math.radians(235.0), math.radians(38.0)      # from the south-west, afternoon (a look choice)
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("world") if not bpy.context.scene.world else bpy.context.scene.world
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.018, 0.022, 0.032, 1)
    bg.inputs["Strength"].default_value = 1.0
    return cam


def main():
    o = parse(sys.argv)
    w, hgt = (int(x) for x in o.get("size", "1600x900").split("x"))
    samples = int(o.get("samples", 32))
    shot = o.get("shot", "depth")
    out = o.get("out", os.path.join(REPO, "build", "preview", "underground-khafre-%s%s.png" % (shot, "-reply" if "reply" in o else "")))
    clear()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    coll = bpy.data.collections.new("underground")
    scene.collection.children.link(coll)
    k, c = build(coll, cut_only=SHOTS[shot].get("cut_only", False), reply="reply" in o)
    cam = camera_and_light(k, (w, hgt), shot)
    renderer.gpu(scene)
    renderer.configure(scene, exposure=0.0)
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = w, hgt
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.0
    scene.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    meta = dict(
        render=os.path.relpath(out, REPO), shot=shot, size=[w, hgt], samples=samples,
        camera=dict(location=list(cam.location), rotation_euler=list(cam.rotation_euler), lens=cam.data.lens,
                    sensor_width=cam.data.sensor_width),
        receipts=U.receipts(c, k), reply_levels=U.reply_levels(c, k) if "reply" in o else None, look_choices=U.LOOK,
        note="Claimed geometry from data/measurements/g2-sar.json; spacing, offset, pitch and the Zeds' size are look choices.",
    )
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("wrote", out)


main()
