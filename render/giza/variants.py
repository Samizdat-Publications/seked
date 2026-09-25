"""
The few meshes every instance is drawn from: weathered blocks, broken rocks, people.
A handful of variants of each, instanced hundreds of thousands of times, costs Cycles
almost nothing in memory. The originals are parked far below the world, because an
instance inherits its original's ray visibility and so they cannot simply be hidden.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector, noise

PARKED = (0.0, 0.0, -20000.0)


def fbm3(p, octaves=4):
    total, amp, norm = 0.0, 1.0, 0.0
    for i in range(octaves):
        total += amp * noise.noise(p * (2.0 ** i), noise_basis="PERLIN_NEW")
        norm += amp
        amp *= 0.5
    return total / norm


def block(seed, rounding, erosion, chips=2, cuts=10, shear=0.0, front_bias=1.0, base_zero=False, batter=0.0, smooth=True):
    """
    A unit block (-0.5..0.5; front +Y, up +Z), rounded and eroded, most on the front
    and top where the weather reaches. `shear` slopes the front back at the top, for a
    casing stone; `batter` draws the walls in towards the top; `base_zero` puts the
    base at z = 0 for things that stand on the ground.
    """
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    off = Vector((rnd.uniform(-99, 99), rnd.uniform(-99, 99), rnd.uniform(-99, 99)))
    chip_pts = [(Vector((rnd.choice((-0.5, 0.5)), rnd.uniform(0.1, 0.5), rnd.choice((0.5, 0.5, -0.5)))),
                 rnd.uniform(0.12, 0.32)) for _ in range(rnd.randint(0, chips))]
    r = rounding
    for v in bm.verts:
        p0 = v.co.copy()
        q = Vector((max(min(p0.x, 0.5 - r), r - 0.5), max(min(p0.y, 0.5 - r), r - 0.5), max(min(p0.z, 0.5 - r), r - 0.5)))
        d = p0 - q
        p = q + d.normalized() * r if d.length > 1e-9 else p0.copy()
        nrm = d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))
        exposed = 1.0 + front_bias * max(0.0, nrm.y) + 0.6 * max(0.0, nrm.z)
        edge = sum(1 for c in (p0.x, p0.y, p0.z) if abs(c) > 0.5 - 1.6 * r)
        p = p + nrm * (fbm3(p * 2.7 + off) * erosion * exposed * (1.0 + 0.7 * max(0, edge - 1)))
        for c, cr in chip_pts:
            dd = (p - c).length
            if dd < cr:
                p = p - nrm * (cr - dd) * 0.9
        if shear:
            p.y -= shear * (p.z + 0.5) * (p.y + 0.5)
        if batter:
            s = 1.0 - batter * (p.z + 0.5)
            p.x *= s
            p.y *= s
        if base_zero:
            p.z += 0.5
        v.co = p
    me = bpy.data.meshes.new(f"block {seed}")
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    else:
        me.shade_flat()
    return me


def rock(seed, rough=0.28):
    """A broken lump of limestone: a noisy sphere with flakes sheared off, crisp where they broke."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=0.5)
    off = Vector((rnd.uniform(-99, 99), rnd.uniform(-99, 99), rnd.uniform(-99, 99)))
    sx, sy, sz = rnd.uniform(0.8, 1.2), rnd.uniform(0.7, 1.1), rnd.uniform(0.45, 0.75)
    cuts = [(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized(), rnd.uniform(0.28, 0.42))
            for _ in range(3)]
    for v in bm.verts:
        p = v.co.copy()
        p = p + p.normalized() * fbm3(p * 2.2 + off, 3) * rough
        for axis, dist in cuts:
            dp = p.dot(axis)
            if dp > dist:
                p -= axis * (dp - dist)
        v.co = Vector((p.x * sx, p.y * sy, p.z * sz))
    for f in bm.faces:
        f.smooth = True
    bm.normal_update()
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(38):
            e.smooth = False
    me = bpy.data.meshes.new(f"rock {seed}")
    bm.to_mesh(me)
    bm.free()
    return me


def person(seed):
    """A figure for scale: at the distances the stations see people from, a few pixels tall."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    h = rnd.uniform(0.92, 1.05)
    for (x, z), rad, ln in (((0.0, 0.78 * h), 0.2, 0.62 * h), ((0.07, 0.4 * h), 0.075, 0.8 * h), ((-0.07, 0.4 * h), 0.075, 0.8 * h)):
        m = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=rad, radius2=rad * 0.85, depth=ln)
        for v in m["verts"]:
            v.co += Vector((x, 0.0, z))
    s = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.11)
    for v in s["verts"]:
        v.co += Vector((0, 0, 1.2 * h + 0.12))
    me = bpy.data.meshes.new(f"person {seed}")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def collection(parent, name, meshes, material):
    """A collection of variants, named so Collection Info picks them in order."""
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    for i, me in enumerate(meshes):
        me.materials.append(material)
        ob = bpy.data.objects.new(f"{name} {i:02d}", me)
        ob.location = PARKED
        c.objects.link(ob)
    return c


SHEARS = [0.2, 0.26, 0.32, 0.38, 0.44, 0.5, 0.58, 0.66, 0.75]
N_CORE = 16
N_DRESSED = 4


def library(parent, mats, state, rng):
    """Every variant set the layers use."""
    lib = {}
    lib["core"] = collection(parent, "v core", [block(100 + i, rounding=rng.uniform(0.11, 0.19), erosion=0.045)
                                                for i in range(N_CORE)], mats["core"])
    if state == "today":
        lib["casing"] = collection(parent, "v casing", [block(300 + i, rounding=0.05, erosion=0.018, chips=1, cuts=6, shear=s)
                                                        for i, s in enumerate(SHEARS)], mats["casing"])
    else:
        lib["casing"] = collection(parent, "v casing", [block(300 + i, rounding=0.008, erosion=0.0, chips=0, cuts=2, shear=s)
                                                        for i, s in enumerate(SHEARS)], mats["casing"])
    lib["granite"] = collection(parent, "v granite", [block(400 + i, rounding=0.12, erosion=0.07, chips=1, cuts=8, shear=s, front_bias=2.5)
                                                      for i, s in enumerate(SHEARS)], mats["granite"])
    lib["rock"] = collection(parent, "v rock", [rock(500 + i) for i in range(12)], mats["rock"])
    lib["dressed granite"] = collection(parent, "v dressed granite", [block(600 + i, rounding=0.012, erosion=0.002, chips=0, cuts=2, smooth=False)
                                                                      for i in range(N_DRESSED)], mats["granite blocks"])
    lib["dressed limestone"] = collection(parent, "v dressed limestone", [block(620 + i, rounding=0.012, erosion=0.002, chips=0, cuts=2, smooth=False)
                                                                          for i in range(N_DRESSED)], mats["limestone blocks"])
    lib["box"] = collection(parent, "v box", [block(700, rounding=0.0, erosion=0.0, chips=0, cuts=1, base_zero=True, smooth=False)], mats["city"])
    lib["people"] = collection(parent, "v people", [person(800 + i) for i in range(4)], mats["people"])
    return lib
