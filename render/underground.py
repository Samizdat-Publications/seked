"""
Chapter 8's cutaway: Khafre's pyramid and the plateau cut on a north-south plane through its axis,
the known rooms in stone, the Khafre Project's claimed wells, spirals, cubes and Zeds in the claimed
tier's look, and Khafre's height laid end to end down the depth for scale.

    blender -b --factory-startup -P render/underground.py -- --shot depth --size 1600x900 --samples 32
    blender -b --factory-startup -P render/underground.py -- --shot base
    blender -b --factory-startup -P render/underground.py -- --shot depth --reply 1     # the reply's three lines
    blender -b --factory-startup -P render/underground.py -- --shot depth --plate 1     # the linked tomogram's frame
    blender -b --factory-startup -P render/underground.py -- --shot descent:0.5        # the descent's camera halfway down
    blender -b --factory-startup -P render/underground.py -- --shot depth --style solid # sawn open, the hollows solid

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
from giza.diagram import box, clear, cylinder, material, mesh, polyline  # noqa: E402

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


def build(coll, cut_only=False, reply=False, plate=False):
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
        plate=material("plate, linked", (0.55, 0.56, 0.58), alpha=0.55, rough=1.0),
        frame=material("plate frame", (0.85, 0.86, 0.88), emit=1.5),
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
    if plate:
        # The Khafre Project's tomogram, linked until permission (assets/plates/manifest.json): a grey frame on the
        # section plane, placed by the figure's own labels (the base and 648 m) across the footprint, never scaled.
        z0, z1, ya, yb = b + c["bottom"], b, cy - h, cy + h
        mesh("plate: Khafre Project tomogram (linked)", [(cx - 0.4, ya, z0), (cx - 0.4, yb, z0), (cx - 0.4, yb, z1), (cx - 0.4, ya, z1)],
             [(0, 1, 2, 3)], M["plate"], coll)
        polyline("plate frame", [(cx - 0.8, ya, z0), (cx - 0.8, yb, z0), (cx - 0.8, yb, z1), (cx - 0.8, ya, z1)], 1.0, M["frame"], coll, closed=True)
    if reply:
        # The reply's three lines across the cut: radar's reach by the claimant's own figure, the water table, the claim.
        for name, z in U.reply_levels(c, k).items():
            polyline("reply " + name, [(cx - 1.0, cy - HALF_SPAN, z), (cx - 1.0, cy + HALF_SPAN, z)], 1.6, M[name], coll)
    return k, c


# The solid cutaway (--style solid): the same claim as the x-ray, drawn as if the plateau had been sawn open. The cut
# runs north-south through the east row's axes, so its four wells, their spirals and their cube open on the cut face as
# real hollows, and the west row is in the half taken away. The rock is layered limestone, the pyramid its own stone,
# and an orange dashed rim round every claimed hollow on the face says what is a claim. Every size comes from
# render/giza/underground.py; the strata's colours and thicknesses are look choices.
TUNNEL_HEIGHT = 2.5          # m: the spiral path's headroom (look choice, like its width and pitch in U.LOOK)


def textured(name, role, tint, scale=1.0, bump=0.5, strata=False, rough=0.9):
    """A material from a CC0 photograph (blender/textures.json role), box-projected at its own size times `scale`,
    keeping only its light and dark over `tint`; with `strata`, banded in height like bedded limestone."""
    from giza.materials import TEX, image
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
    di = N.new("ShaderNodeTexImage"); di.image, di.projection, di.projection_blend = image(role, "Diffuse"), "BOX", 0.3
    hm = N.new("ShaderNodeTexImage"); hm.image, hm.projection, hm.projection_blend = image(role, "Displacement", True), "BOX", 0.3
    L.new(mp.outputs[0], di.inputs["Vector"]); L.new(mp.outputs[0], hm.inputs["Vector"])
    bw = N.new("ShaderNodeRGBToBW"); L.new(di.outputs["Color"], bw.inputs[0])
    rng = N.new("ShaderNodeMapRange")
    rng.inputs[1].default_value, rng.inputs[2].default_value = 0.0, 0.6
    rng.inputs[3].default_value, rng.inputs[4].default_value = 0.5, 1.25
    L.new(bw.outputs[0], rng.inputs[0])
    grey = N.new("ShaderNodeCombineColor")
    for k in range(3):
        L.new(rng.outputs[0], grey.inputs[k])
    colour = N.new("ShaderNodeMix"); colour.data_type, colour.blend_type = "RGBA", "MULTIPLY"
    colour.inputs[0].default_value = 1.0
    colour.inputs[6].default_value = tint
    if strata:
        # beds: a ramp of limestone tones read along height, warped a little by noise so the beds are not ruled lines
        sep = N.new("ShaderNodeSeparateXYZ"); L.new(co, sep.inputs[0])
        nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.004; nz.inputs["Detail"].default_value = 3.0
        L.new(co, nz.inputs["Vector"])
        warp = N.new("ShaderNodeMath"); warp.operation = "MULTIPLY_ADD"
        L.new(nz.outputs["Fac"], warp.inputs[0]); warp.inputs[1].default_value = 5.0; L.new(sep.outputs["Z"], warp.inputs[2])
        bed = N.new("ShaderNodeMath"); bed.operation = "MULTIPLY"; bed.inputs[1].default_value = 1 / 60.0
        L.new(warp.outputs[0], bed.inputs[0])
        fr = N.new("ShaderNodeMath"); fr.operation = "FRACT"; L.new(bed.outputs[0], fr.inputs[0])
        ramp = N.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "EASE"
        el = ramp.color_ramp.elements
        # five beds of uneven thickness in each 60 m, each a little different in tone, with thin dark partings
        tones = [(0.0, (0.80, 0.69, 0.52)), (0.17, (0.80, 0.69, 0.52)), (0.18, (0.50, 0.43, 0.34)),
                 (0.19, (0.70, 0.61, 0.48)), (0.40, (0.70, 0.61, 0.48)), (0.41, (0.48, 0.41, 0.33)),
                 (0.42, (0.85, 0.76, 0.60)), (0.62, (0.85, 0.76, 0.60)), (0.63, (0.50, 0.43, 0.34)),
                 (0.64, (0.62, 0.54, 0.43)), (0.83, (0.62, 0.54, 0.43)), (0.84, (0.50, 0.43, 0.34)),
                 (0.85, (0.76, 0.66, 0.50)), (1.0, (0.80, 0.69, 0.52))]
        for k, (p, c) in enumerate(tones):
            e = el[k] if k < 2 else el.new(p)
            e.position, e.color = p, (*c, 1.0)
        L.new(fr.outputs[0], ramp.inputs[0])
        L.new(ramp.outputs[0], colour.inputs[6])
    L.new(grey.outputs[0], colour.inputs[7])
    L.new(colour.outputs[2], b.inputs["Base Color"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.3
    L.new(hm.outputs["Color"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def tube(name, path, width, height, coll):
    """A rectangular tube swept along a path (N, 3): its floor on the path, `width` across and `height` up."""
    import numpy as np
    p = np.asarray(path, dtype=float)
    tan = np.gradient(p, axis=0)
    tan /= np.linalg.norm(tan, axis=1)[:, None]
    side = np.cross(tan, [0.0, 0.0, 1.0])
    side /= np.linalg.norm(side, axis=1)[:, None]
    up = np.array([0.0, 0.0, 1.0])
    corners = [(-0.5, 0.0), (0.5, 0.0), (0.5, 1.0), (-0.5, 1.0)]
    verts = np.concatenate([p + side * a * width + up * b * height for a, b in corners], axis=0)
    n = len(p)
    faces = []
    for k in range(4):
        a, c = k * n, ((k + 1) % 4) * n
        faces += [(a + i, a + i + 1, c + i + 1, c + i) for i in range(n - 1)]
    faces += [(0, n, 2 * n, 3 * n), (n - 1 + 3 * n, n - 1 + 2 * n, n - 1 + n, n - 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def build_solid(coll, reply=False):
    import bmesh
    import numpy as np
    k, c = U.khafre(), U.claim()
    cx, cy, b, h, H = k["cx"], k["cy"], k["base"], k["side"] / 2, k["H"]
    wells = U.wells(c, k)
    cut_x = max(w["x"] for w in wells)                     # the east row's axes
    east = [w for w in wells if abs(w["x"] - cut_x) < 1e-6]
    cube = max(U.cubes(c, k), key=lambda q: q["x"])
    M = dict(
        rock=textured("bedded limestone (section)", "core", (1.0, 1.0, 1.0, 1.0), scale=8.0, bump=0.1, strata=True),
        hollow=textured("the claimed hollows' walls", "bedrock", (0.42, 0.37, 0.31, 1.0), scale=6.0, bump=0.4),
        ground=textured("plateau surface", "sand", (0.80, 0.68, 0.50, 1.0), scale=4.0, bump=0.3),
        stone=textured("Khafre's limestone", "core", (0.80, 0.70, 0.55, 1.0), scale=3.0, bump=0.5),
        edge=material("claimed edges", (1.0, 0.52, 0.12), emit=2.2, dashes=4.0, alpha=1.0),
        scale=material("scale", (0.92, 0.95, 1.0), emit=2.5),
        radar=material("reply: radar's reach", (0.80, 0.92, 1.0), emit=2.5),
        water=material("reply: water table", (0.20, 0.50, 1.0), emit=2.5),
        claim=material("reply: the claim's depth", (1.0, 0.45, 0.08), emit=2.5),
    )
    # the rock east of the cut, with the claim's hollows taken out of it
    x0, x1, y0, y1, z0, z1 = cut_x, cut_x + EAST, cy - HALF_SPAN, cy + HALF_SPAN, b - DEPTH_BELOW, b
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    block = mesh("plateau, sawn open", v, f, M["rock"], coll, face_mats=[0, 1, 0, 0, 0, 0], mats=(M["ground"],))
    cutters = bpy.data.collections.new("the claim's hollows")
    for i, w in enumerate(east):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=w["radius"], radius2=w["radius"],
                              depth=w["top"] - w["bottom"] + 1.0)
        bmesh.ops.translate(bm, vec=(w["x"], w["y"], (w["top"] + w["bottom"]) / 2), verts=bm.verts)
        me = bpy.data.meshes.new("well %d (claimed)" % (i + 1))
        bm.to_mesh(me)
        bm.free()
        me.materials.append(M["hollow"])
        cutters.objects.link(bpy.data.objects.new(me.name, me))
        tube("spiral %d (claimed)" % (i + 1), U.helix(w, step_deg=6.0), U.LOOK["spiral_width"], TUNNEL_HEIGHT,
             cutters).data.materials.append(M["hollow"])
    s2 = cube["side"] / 2
    box("cube (claimed)", cube["x"] - s2, cube["x"] + s2, cube["y"] - s2, cube["y"] + s2, cube["z"] - s2, cube["z"] + s2,
        M["hollow"], cutters)
    for ob in cutters.objects:                       # closed and outward-facing, for the exact solver
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
    bo = block.modifiers.new("the claim's hollows", "BOOLEAN")
    bo.operation, bo.operand_type, bo.solver = "DIFFERENCE", "COLLECTION", "EXACT"
    bo.material_mode = "TRANSFER"                    # the hollows keep their own darker stone
    bo.collection = cutters
    # Khafre, sawn on the same plane: the part east of the cut, its section filled
    bm = bmesh.new()
    pts = [bm.verts.new(p) for p in [(cx - h, cy - h, b), (cx + h, cy - h, b), (cx + h, cy + h, b), (cx - h, cy + h, b),
                                     (cx, cy, b + H)]]
    for tri in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)):
        bm.faces.new([pts[i] for i in tri])
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(cut_x, 0, 0), plane_no=(1, 0, 0), clear_inner=True)
    edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.edgeloop_fill(bm, edges=edges)
    me = bpy.data.meshes.new("Khafre, sawn")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M["stone"])
    coll.objects.link(bpy.data.objects.new(me.name, me))
    # the orange dashed rims of the claimed hollows on the cut face, so nobody takes them for found rooms
    xf = cut_x - 0.4
    for w in east:
        r = w["radius"]
        polyline("rim, well", [(xf, w["y"] - r, w["top"]), (xf, w["y"] - r, w["bottom"]), (xf, w["y"] + r, w["bottom"]),
                               (xf, w["y"] + r, w["top"])], 0.3, M["edge"], coll)
    polyline("rim, cube", [(xf, cube["y"] - s2, cube["z"] + s2), (xf, cube["y"] - s2, cube["z"] - s2),
                           (xf, cube["y"] + s2, cube["z"] - s2), (xf, cube["y"] + s2, cube["z"] + s2)], 0.5, M["edge"], coll,
             closed=True)
    # Khafre's height laid end to end down the claimed depth, on the cut face north of the pyramid, for scale
    ya, yb = cy + h + 25.0, cy + h + 25.0 + 2 * h
    for i, (top, bot, frac) in enumerate(U.stack(-c["bottom"], H)):
        apex = b + top
        if frac >= 1.0:
            pts = [(xf, ya, apex - H), (xf, yb, apex - H), (xf, (ya + yb) / 2, apex)]
        else:
            zc, t = b + bot, (apex - (b + bot)) / H
            pts = [(xf, (ya + yb) / 2 - h * t, zc), (xf, (ya + yb) / 2 + h * t, zc), (xf, (ya + yb) / 2, apex)]
        polyline("Khafre height %d" % (i + 1), pts, 0.9, M["scale"], coll, closed=True)
    if reply:
        for name, z in U.reply_levels(c, k).items():
            polyline("reply " + name, [(xf - 0.6, cy - HALF_SPAN, z), (xf - 0.6, cy + HALF_SPAN, z)], 1.6, M[name], coll)
    return k, c, cut_x

# The two views: the whole depth, and the base, where the known rooms and the tops of the wells are.
SHOTS = {
    "depth": dict(target=(40.0, 40.0, -330.0), location=(-2150.0, -1250.0, 300.0)),
    # an elevation of the section, as an architect draws one: orthographic, from due west, and showing only
    # what lies behind the cut (the west row stands in the removed half)
    "base": dict(target=(0.0, 42.0, 14.0), location=(-900.0, 42.0, 40.0), ortho=150.0, cut_only=True),
    # the solid cutaway's close shots: the wells' tops under Khafre, and the chamber they fall into (look choices)
    "top": dict(target=(50.0, 0.0, -45.0), location=(-150.0, -170.0, 30.0), lens=35.0),
    "bottom": dict(target=(50.0, 0.0, -690.0), location=(-120.0, -150.0, -600.0), lens=35.0),
}


def camera_and_light(k, size, shot="depth", c=None, sun_from=(235.0, 38.0), fill=False):
    cx, cy, b = k["cx"], k["cy"], k["base"]
    s = U.descent(min(1.0, max(0.0, float(shot.split(":")[1]))), k, c) if shot.startswith("descent:") else SHOTS[shot]
    target = Vector((cx + s["target"][0], cy + s["target"][1], b + s["target"][2]))
    loc = Vector((cx + s["location"][0], cy + s["location"][1], b + s["location"][2]))
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = s.get("lens", 50.0)
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
    az, el = math.radians(sun_from[0]), math.radians(sun_from[1])   # look choices: the x-ray from the south-west;
    # the solid cutaway from the south, low, so it rakes across the cut face and the hollows hold their shadows
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("world") if not bpy.context.scene.world else bpy.context.scene.world
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.018, 0.022, 0.032, 1)
    bg.inputs["Strength"].default_value = 1.0
    if fill:
        # the solid cutaway's soft fill, so the side of the cut the low sun leaves in shade still reads (look choice)
        # lighting only: the camera still sees the dark backdrop
        nt = world.node_tree
        lp = nt.nodes.new("ShaderNodeLightPath")
        lit = nt.nodes.new("ShaderNodeBackground")
        lit.inputs["Color"].default_value = (0.10, 0.115, 0.14, 1)
        lit.inputs["Strength"].default_value = 2.2
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
        nt.links.new(lit.outputs[0], mix.inputs[1])
        nt.links.new(bg.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], nt.nodes["World Output"].inputs["Surface"])
    return cam


def main():
    o = parse(sys.argv)
    w, hgt = (int(x) for x in o.get("size", "1600x900").split("x"))
    samples = int(o.get("samples", 32))
    shot = o.get("shot", "depth")
    out = o.get("out", os.path.join(REPO, "build", "preview", "underground-khafre-%s%s%s%s.png" % (
        shot, "-solid" if o.get("style") == "solid" else "", "-reply" if "reply" in o else "", "-plate" if "plate" in o else "")))
    clear()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    coll = bpy.data.collections.new("underground")
    scene.collection.children.link(coll)
    style = o.get("style", "xray")
    if style == "solid":
        k, c, _ = build_solid(coll, reply="reply" in o)
    else:
        k, c = build(coll, cut_only=SHOTS.get(shot, {}).get("cut_only", False), reply="reply" in o, plate="plate" in o)
    cam = camera_and_light(k, (w, hgt), shot, c, sun_from=(188.0, 24.0) if style == "solid" else (235.0, 38.0),
                           fill=style == "solid")
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
        style=style,
        note="Claimed geometry from data/measurements/g2-sar.json; spacing, offset, pitch and the Zeds' size are look choices.",
        claim_status=("A claim: the Khafre Project's wells, spirals and cubes (conference abstract, March 2025, not peer "
                      "reviewed). The method's only peer-reviewed paper, Biondi & Malanga 2022 on Khufu's pyramid, was "
                      "retracted on 10 August 2026 (Remote Sensing 18(16), 2679); the authors disagree."),
    )
    with open(os.path.splitext(out)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("wrote", out)


main()
