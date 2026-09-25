"""
The pyramids, course by course.

Survey numbers (sides, heights, slopes, Khufu's 201 course heights, Khafre's cap,
Menkaure's granite band) come from data.py. Everything in LOOK below is a look
choice: how deep the casing was, how often a core block is gone, how ragged a corner
is. Changing one changes the picture and never a claim.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from . import data, states
from .instancing import Field
from .variants import N_CORE, SHEARS, block

# Look choices, per pyramid, for the present-day state.
LOOK = {
    "g1": dict(T=1.7, conc=0.94, miss=0.02, corner=0.55,
               # (face, u0, u1, z0, z1, probability): the recess round the original
               # entrance on the north face, 7.29 m east of the axis, and al-Ma'mun's tunnel.
               holes=[(0, 4.0, 10.8, 14.5, 24.0, 0.85), (0, -3.2, 2.2, 4.0, 10.5, 0.9)]),
    "g2": dict(T=1.9, conc=0.0, miss=0.03, corner=0.6, casing_miss=0.03, casing_wear=0.6, granite_miss=0.55),
    "g3": dict(T=1.6, conc=0.0, miss=0.03, corner=0.5, granite_miss=0.35,
               holes=[(0, -7.0, 7.0, 12.0, 38.0, 0.8)]),        # the gash of 1196
    "queen": dict(T=1.0, conc=0.0, miss=0.12, corner=0.7),
}
# Generated course heights where no survey gives them: (bottom, top) in metres.
COURSES = {"g2": (1.35, 0.6), "g3": (1.05, 0.6), "queen": (0.9, 0.55)}
PYRAMIDION_HEIGHT = 1.4          # data/measurements/pristine.json, g1/g2/g3.pyramidion.height

# Faces: N, W, S, E, each the outward +Y of a block turned about Z.
FACE_ROT = [0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi]


def course_heights(total, rng, bottom, top):
    hs, z = [], 0.0
    while z < total - 0.3:
        h = (bottom + (top - bottom) * z / total) * rng.uniform(0.82, 1.18)
        hs.append(h)
        z += h
    hs[-1] -= z - total
    return hs


def to_world(P, f, u, v):
    """Face coordinates (u along the face, v outward from the centre) to plan."""
    a = FACE_ROT[f]
    c, s = math.cos(a), math.sin(a)
    return P["cx"] + u * c - v * s, P["cy"] + u * s + v * c


def lay(P, courses, rng, core, casing, gran, spec):
    """
    Lay one pyramid course by course. `spec` holds the LOOK entries and: `top` (height
    of the last course), `cap_z` (casing kept above this, ragged), `granite_to` (granite
    casing below this), `all_casing`. Returns the core-behind steps (z0, z1, half-width).
    """
    half, H, base = P["half"], P["H"], P["base"]
    cot = half / H
    T = spec.get("T", 1.6)
    conc = spec.get("conc", 0.0)
    cap_z = spec.get("cap_z")
    all_casing = spec.get("all_casing", False)
    granite_to = spec.get("granite_to", -1.0)
    D_case = T + 1.1
    courses = list(courses)
    while sum(courses) < spec["top"] - 0.2:
        courses.append(rng.uniform(0.5, 0.6))
    z = 0.0
    backing = []
    seed = rng.random() * 1000
    for k, h in enumerate(courses):
        zb, zt = z, z + h
        z = zt
        if zt > spec["top"] + 1e-6:
            break
        Wc_b = half - zb * cot
        Wc_m = half - (zb + h / 2) * cot
        W = half - zt * cot - T
        if Wc_m < 0.7:
            break
        if W > 0.3:
            backing.append((zb, zt, max(W - 0.9, 0.2)))
        cased_course = all_casing or (cap_z is not None and zb > cap_z - 4.0) or zb < granite_to
        Wrow = Wc_m if cased_course else W
        if Wrow < 0.6:
            break
        inset = D_case if cased_course else 1.25
        full_pair = k % 2 == 0
        for f in range(4):
            full = (f % 2 == 0) == full_pair
            u = -Wrow if full else -(Wrow - inset)
            u_end = Wrow if full else (Wrow - inset)
            while u < u_end - 0.05:
                L = min(max(rng.lognormvariate(math.log(1.25 * (0.65 + 0.35 * h)), 0.33), 0.55), 2.8)
                if u + L > u_end - 0.4:
                    L = u_end - u
                uc = u + L / 2
                u += L
                edge_d = Wrow - abs(uc)
                granite = zb < granite_to
                cased = all_casing or granite
                if cap_z is not None and not granite:
                    cased = zb > cap_z + 3.5 * noise.noise(Vector((uc * 0.045 + f * 17.3, seed, 0.0)))
                if cased:
                    if granite and not all_casing:
                        gone = rng.random() < spec.get("granite_miss", 0.3) + 0.4 * math.exp(-edge_d / 6.0)
                    else:
                        gone = rng.random() < spec.get("casing_miss", 0.0)
                        if gone:
                            continue          # a hole in the cap: the core behind shows
                    if not gone:
                        shear = min(max(h * cot / D_case, 0.0), 0.9)
                        vi = min(range(len(SHEARS)), key=lambda i: abs(SHEARS[i] - shear))
                        x, y = to_world(P, f, uc, Wc_b - D_case / 2)
                        (gran if granite else casing).add(
                            (x, y, base + zb + h / 2), (0.0, 0.0, FACE_ROT[f] + rng.gauss(0, 0.002)),
                            (L - 0.012, D_case, h - 0.012), vi, rng.random(), rng.random() * spec.get("casing_wear", 0.3))
                        continue
                    # the granite is gone here, and the core behind it shows
                if abs(uc) > W - 0.2:
                    continue
                p = spec["miss"] + spec["corner"] * math.exp(-(W - abs(uc)) / 3.0) * (1.0 if zb < 0.55 * H else 0.5)
                patch = noise.noise(Vector((uc * 0.035 + f * 31.7, zb * 0.06, seed + 5.0)))
                if patch > 0.38:
                    p += (patch - 0.38) * 1.6
                if zt > spec["top"] - 4.0:
                    p += 0.25
                for (fx, u0, u1, z0, z1, pp) in spec.get("holes", ()):
                    if f == fx and u0 < uc < u1 and z0 < zb + h / 2 < z1:
                        p = pp
                if rng.random() < p:
                    continue
                D = rng.uniform(1.25, 1.7)
                vj = W - conc * max(0.0, 1.0 - abs(uc) / W) - D / 2 + rng.gauss(0, 0.05)
                hh = h - 0.05 - rng.random() * 0.05
                dmg = rng.random()
                if dmg < 0.10:
                    hh *= rng.uniform(0.55, 0.9)      # the top broken off
                if dmg > 0.93:
                    vj -= rng.uniform(0.1, 0.35)      # the face spalled back
                x, y = to_world(P, f, uc, vj)
                core.add((x, y, base + zb + hh / 2 + 0.01),
                         (rng.gauss(0, 0.012), rng.gauss(0, 0.012), FACE_ROT[f] + rng.gauss(0, 0.02)),
                         (L - rng.uniform(0.03, 0.09), D, hh), rng.randrange(N_CORE), rng.random(), rng.random())
    return backing


def mesh_object(name, verts, faces, coll, materials=()):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for m in materials:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def backing_mesh(P, backing, coll, mat):
    """The stepped core behind the facing blocks, seen only where a block is gone."""
    verts, faces = [], []
    cx, cy, base = P["cx"], P["cy"], P["base"]

    def ring(w, zz):
        i = len(verts)
        verts.extend([(cx - w, cy - w, zz), (cx + w, cy - w, zz), (cx + w, cy + w, zz), (cx - w, cy + w, zz)])
        return i

    prev = None
    for zb, zt, w in backing:
        b, t = ring(w, base + zb), ring(w, base + zt)
        faces += [(b + e, b + (e + 1) % 4, t + (e + 1) % 4, t + e) for e in range(4)]
        if prev is not None:
            faces += [(prev + e, prev + (e + 1) % 4, b + (e + 1) % 4, b + e) for e in range(4)]
        prev = t
    if prev is not None:
        faces.append((prev, prev + 1, prev + 2, prev + 3))
    return mesh_object(P["name"] + " core behind", verts, faces, coll, (mat,))


def dressed_mesh(P, top, granite_to, coll, m_case, m_gran):
    """A cased pyramid: four dressed faces to `top`, granite below `granite_to`, sharp arrises."""
    cx, cy, base, half, H = P["cx"], P["cy"], P["base"], P["half"], P["H"]
    cot = half / H
    verts, faces, mats = [], [], []

    def ring(zz):
        w = half - zz * cot
        i = len(verts)
        verts.extend([(cx - w, cy - w, base + zz), (cx + w, cy - w, base + zz), (cx + w, cy + w, base + zz), (cx - w, cy + w, base + zz)])
        return i

    levels = [0.0] + ([granite_to] if granite_to > 0 else []) + [top]
    rings = [ring(zz) for zz in levels]
    for k in range(len(levels) - 1):
        a, b = rings[k], rings[k + 1]
        for e in range(4):
            faces.append((a + e, a + (e + 1) % 4, b + (e + 1) % 4, b + e))
            mats.append(1 if (granite_to > 0 and k == 0) else 0)
    t = rings[-1]
    faces.append((t, t + 1, t + 2, t + 3))
    mats.append(0)
    ob = mesh_object(P["name"] + " dressed", verts, faces, coll, (m_case, m_gran))
    for poly, mi in zip(ob.data.polygons, mats):
        poly.material_index = mi
    bev = ob.modifiers.new("arris", "BEVEL")
    bev.width = 0.05
    bev.segments = 2
    return ob


def pyramidion(P, coll, mat):
    ph = PYRAMIDION_HEIGHT
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=ph * P["half"] / P["H"] * math.sqrt(2), radius2=0.0, depth=ph)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(45), 3, "Z"))
    me = bpy.data.meshes.new(P["name"] + " pyramidion")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(P["name"] + " pyramidion", me)
    coll.objects.link(ob)
    ob.location = (P["cx"], P["cy"], P["base"] + P["H"] - ph / 2)
    return ob


def khufu_north_face(coll, mats, mast=True):
    """The gable stones over the original entrance, the dark mouths, and the summit mast."""
    g1 = data.PYRAMIDS["g1"]
    cot = g1["half"] / g1["H"]
    T = LOOK["g1"]["T"]
    for zc, span, thick in ((19.6, 4.9, 1.6), (22.2, 6.2, 1.8)):
        for side in (-1, 1):
            me = block(900 + int(zc * 10) + side, rounding=0.12, erosion=0.05, chips=1)
            me.materials.append(mats["core"])
            ob = bpy.data.objects.new("entrance gable", me)
            coll.objects.link(ob)
            face = g1["half"] - zc * cot - T
            ob.location = (7.29 + side * span * 0.25, face - 1.0, zc)
            ob.rotation_euler = (0, side * math.radians(40), 0)
            ob.scale = (span * 0.55, 2.2, thick)
            ob["tone"], ob["wear"], ob["scl"] = 0.3, 0.4, (span * 0.55, 2.2, thick)
    for x0, zc, w, hh in ((7.29, 17.6, 1.05, 1.2), (-0.6, 7.2, 3.0, 2.6)):
        me = block(990 + int(zc), rounding=0.0, erosion=0.0, chips=0, cuts=1)
        me.materials.append(mats["dark"])
        ob = bpy.data.objects.new("mouth", me)
        coll.objects.link(ob)
        ob.location = (x0, g1["half"] - zc * cot - T - 2.6, zc)
        ob.scale = (w, 3.0, hh)
    # David Gill's mast of 1874 stands on the summit platform to the original apex.
    if not mast:
        return
    top = g1["today"]
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.05, depth=g1["H"] - top)
    me = bpy.data.meshes.new("summit mast")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["core"])
    ob = bpy.data.objects.new("summit mast", me)
    coll.objects.link(ob)
    ob.location = (0, 0, top + (g1["H"] - top) / 2)


CASING_FOR = {"dressed": "coursed casing", "pristine": "pristine casing", "weathered": "weathered casing"}
CAP_FOR = {"gold": "gold", "electrum": "electrum"}


def build(state, rng, coll, mats, lib, log=print):
    """Every pyramid the state has. Returns the footprints the terrain must flatten under."""
    S = states.spec(state)
    mode, queens_mode = S["pyramids"], S["queens"]
    main = [dict(data.PYRAMIDS[k], key=k) for k in ("g1", "g2", "g3")]
    queens = [dict(q, key="queen") for q in data.QUEENS] if queens_mode else []
    core, casing, gran = Field(), Field(), Field()

    def laid(P):
        key = P["key"]
        spec = dict(LOOK[key])
        if key == "queen":
            spec["top"] = P["H"] * rng.uniform(0.55, 0.7)
            courses = course_heights(P["H"], rng, *COURSES["queen"])
        else:
            spec["top"] = P["today"]
            courses = data.G1_COURSES if key == "g1" else course_heights(P["H"], rng, *COURSES[key])
        if key == "g2":
            spec["cap_z"] = P["today"] - P["cap_depth"]
        if P.get("granite_to"):
            spec["granite_to"] = P["granite_to"]
        backing_mesh(P, lay(P, courses, rng, core, casing, gran, spec), coll, mats["core behind"])

    if mode in ("today", "stripped"):
        for P in main:
            laid(P)
        # Khufu's entrance and tunnel are there in both; David Gill's mast only since 1874.
        khufu_north_face(coll, mats, mast=(mode == "today"))
    else:
        face = mats[CASING_FOR[mode]]
        for P in main:
            dressed_mesh(P, P["H"] - PYRAMIDION_HEIGHT, P.get("granite_to") or 0.0, coll, face, mats["dressed granite"])
            pyramidion(P, coll, mats[CAP_FOR[S["caps"]]] if S["caps"] else face)
    if queens_mode == "ruin":
        for P in queens:
            laid(P)
    elif queens_mode == "dressed":
        for P in queens:
            dressed_mesh(P, P["H"] - 0.8, 0.0, coll, mats["coursed casing"], mats["dressed granite"])
    core.emit("core blocks", lib["core"], coll, log)
    casing.emit("casing blocks", lib["casing"], coll, log)
    gran.emit("granite blocks", lib["granite"], coll, log)
    log(f"pyramids {mode}, caps {S['caps']}, {len(queens)} queens {queens_mode}")
    return [(P["cx"], P["cy"], P["half"], P["base"]) for P in main + queens]
