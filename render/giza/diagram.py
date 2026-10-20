"""
Drawing helpers for the diagram stills (render/underground.py, render/labyrinth.py): plain meshes, curves and
x-ray materials, with no scene of their own. Runs inside Blender.
"""
import math

import bpy


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
