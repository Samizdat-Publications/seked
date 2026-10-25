"""
Göbekli Tepe about 9500 BCE: Enclosure D as built, set into its hill (render/gobekli.py --era 9500).

The ring is the plan's stand-in (render/giza/enclosure_d.py: pillar positions and widths scaled from Haklay & Gopher
2020 Fig. 1, the central pair's height and pedestals and the wall's height printed on its p. 347), moved into the
site frame where the scan's registration puts Enclosure D (build/models/gobekli-site-rmark/fit.json), its floor at
the scan's floor there. The plan's wall pillars carry the excavators' numbers, matched by angle to their numbered
plan (docs/gobekli-reliefs.md): a look choice.

Six faces are carved from the cleaned height maps (assets/gobekli-reliefs, scripts/gobekli_reliefs.py): Pillar 43's and
Pillar 33's broad faces, and the central pair's broad sides and narrow fronts (Pillar 18 with its fox, Pillar 31 without). Each is a
fine sheet laid on the stone's face and raised where the drawing raises it, RELIEF metres at most; the stone's
outline for Pillar 43 follows its drawing. The other pillars are plain T's for now, and say so. All of it is a look
reconstruction; nothing about the carving is a measurement.
"""
import json
import math
import os

import bpy
import numpy as np

from giza import enclosure_d as E

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RELIEFS = os.path.join(REPO, "assets", "gobekli-reliefs", "cleaned")
NUMBERS = ["30", "22", "21", "20", "19", "32", "33", "38", "41", "42", "43"]   # the plan's ring_01 to ring_11
CENTRAL = {"central west": "31", "central east": "18"}
# Pillar 33 stands along the wall with its carved face to the ring's middle, as its excavation photograph shows, not
# radially as the schematic plan's bar suggests: turned a quarter and set against the wall's inner face (look choice).
# Pillar 43 stays radial like its neighbours: the DAI puts its relief on the "western broad side", with the reliefs
# on its left "hidden by the perimeter wall" (Dietrich, The Tepe Telegrams, 14 October 2016), which is the outer end
# of a radial pillar in the ring's north-west, seen from the south-west.
ALONG_WALL = {"33"}
# The plan centres every wall pillar on the wall's inner face, burying half its length. Pillar 43's vulture and
# scorpion stand clear of the wall in photographs, only "some more reliefs to the left" hidden: set forward along its
# axis to leave this fraction of its length in the wall (look choice)
SET_IN = {"43": 0.2}
# Pillar 20's carved narrow face is about a third as wide as its shaft is tall in the DAI's photograph; at the stand-in's
# 0.35 m the aurochs is squeezed to half its width, so this one is drawn thicker (look choice)
THICKNESS = {"20": 0.6}
RELIEF = 0.04            # m: the carving's greatest raise (Göbekli's reliefs are mostly low, a few centimetres)
GRID = 0.01              # m: the carved sheet's spacing
# what is carved where: `broad` one broad face (`facing` "inner": the one towards the ring's middle; "west": the one
# with the westward normal), or `sides` both broad faces, or `front` the
# narrow end the pillar's axis points to; `right` what the drawing has on its right, the pillar's "front" (the end
# its axis points to), or nothing for the viewer's own right
CARVED = {
    "43": [dict(relief="p43-front", face="broad", facing="west", outline=True)],
    "18": [dict(relief="p18-side", face="sides", right="front"), dict(relief="p18-front", face="front")],
    "31": [dict(relief="p31-side", face="sides", right="front"), dict(relief="p31-front", face="front")],
    "33": [dict(relief="p33-broad", face="broad", facing="inner", outline=True)],
    # the narrow end facing into the ring, as the DAI's photograph of it between the wall's stretches shows
    "20": [dict(relief="p20-front", face="front", inner=True)],
}


def pillars():
    """The plan's pillars, each with its excavators' number."""
    out = []
    for p in E.pillars():
        if p["name"] in CENTRAL:
            p["number"] = CENTRAL[p["name"]]
        else:
            p["number"] = NUMBERS[int(p["name"].split()[-1]) - 1]
        out.append(p)
    inner = np.array(E.wall()["inner"])
    mid = inner.mean(axis=0)
    for p in out:
        p["thickness"] = THICKNESS.get(p["number"], p["thickness"])
        if p["number"] in SET_IN:
            c = np.array([p["x"], p["y"]])
            f = unit(p["bearing"])
            f = f if np.dot(f, mid - c) > 0 else -f        # along its axis, into the ring
            c = c + f * p["width"] * (0.5 - SET_IN[p["number"]])
            p["x"], p["y"] = float(c[0]), float(c[1])
        if p["number"] in ALONG_WALL:
            # on the wall's inner face where it passes the pillar, its back against it, its broad face along it
            k = int(np.argmin(np.hypot(inner[:, 0] - p["x"], inner[:, 1] - p["y"])))
            tan = inner[(k + 1) % len(inner)] - inner[k - 1]
            nrm = np.array([-tan[1], tan[0]]) / np.linalg.norm(tan)
            if np.dot(nrm, mid - inner[k]) < 0:
                nrm = -nrm                           # into the ring
            # the half-length's sagitta, so its ends clear the curving face too
            half = p["width"] / 2
            r = np.linalg.norm(inner[k] - mid)
            c = inner[k] + nrm * (p["thickness"] / 2 + half * half / (2 * r) + 0.03)
            p["x"], p["y"] = float(c[0]), float(c[1])
            p["bearing"] = math.degrees(math.atan2(tan[0], tan[1])) % 180.0
    return out


def relief(name):
    spec = json.load(open(os.path.join(RELIEFS, "reliefs.json"), encoding="utf-8"))["reliefs"][name]
    im = bpy.data.images.load(os.path.join(RELIEFS, name + ".png"))
    im.colorspace_settings.name = "Non-Color"
    w, h = im.size
    px = np.empty(w * h * im.channels, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, -1)[::-1, :, 0].copy(), spec        # Blender's rows run bottom up


def lookup(h, u, v):
    """Bilinear height at image coordinates u (left to right) and v (top to bottom), 0 to 1."""
    ny, nx = h.shape
    fx = np.clip(u, 0, 1) * (nx - 1)
    fy = np.clip(v, 0, 1) * (ny - 1)
    i0 = np.clip(np.floor(fx).astype(int), 0, nx - 2)
    j0 = np.clip(np.floor(fy).astype(int), 0, ny - 2)
    tx, ty = fx - i0, fy - j0
    return (h[j0, i0] * (1 - tx) * (1 - ty) + h[j0, i0 + 1] * tx * (1 - ty)
            + h[j0 + 1, i0] * (1 - tx) * ty + h[j0 + 1, i0 + 1] * tx * ty)


def sheet(name, h, corner, ru, width, z_top, z_bottom, normal, keep, mat, coll, depth=RELIEF):
    """A carved face: a GRID-spaced sheet from `corner` (its top left, in plan x, y) `width` metres along `ru` and down
    from z_top to z_bottom, standing out along `normal` by the relief's height. Only the quads that carry relief (and
    a cell round them) are kept, and only those `keep(u, v)` allows."""
    nu = max(2, int(round(width / GRID)) + 1)
    nv = max(2, int(round((z_top - z_bottom) / GRID)) + 1)
    u, v = np.meshgrid(np.linspace(0, 1, nu), np.linspace(0, 1, nv))
    hh = lookup(h, u, v)
    off = 0.003 + depth * hh
    X = corner[0] + ru[0] * u * width + normal[0] * off
    Y = corner[1] + ru[1] * u * width + normal[1] * off
    Z = z_top - v * (z_top - z_bottom)
    raised = hh > 0.02
    near = raised.copy()
    near[1:] |= raised[:-1]; near[:-1] |= raised[1:]; near[:, 1:] |= raised[:, :-1]; near[:, :-1] |= raised[:, 1:]
    near &= keep(u, v)
    j, i = np.mgrid[0:nv - 1, 0:nu - 1]
    a = (j * nu + i).ravel()
    q = np.c_[a, a + nu, a + nu + 1, a + 1]
    q = q[near.ravel()[q].all(axis=1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.c_[X.ravel(), Y.ravel(), Z.ravel()].tolist(), [], q.tolist())
    me.shade_smooth()
    me.materials.append(mat)
    # drop the vertices no quad uses
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def unit(b):
    return np.array([math.sin(math.radians(b)), math.cos(math.radians(b))])


def build(coll, mats, ring_centre):
    """The ring's pillars (carved where CARVED says), in the plan's frame: x east, y north, z up from the floor."""
    made = {}
    for p in pillars():
        c = np.array([p["x"], p["y"]])
        f = unit(p["bearing"])                       # along the axis, the end it points to
        n_side = np.array([f[1], -f[0]])             # one broad face's outward normal (the other is minus it)
        W, T, H, base = p["width"], p["thickness"], p["height"], p["base"]
        top = base + H
        carves = CARVED.get(p["number"], [])
        shape = next((k for k in carves if k.get("outline")), None)
        if shape:
            h, spec = relief(shape["relief"])
            if shape["facing"] == "west":
                n = n_side if n_side[0] < 0 else -n_side
            else:
                n = n_side if np.dot(n_side, ring_centre - c) > 0 else -n_side
            ru = np.array([-n[1], n[0]])             # the viewer's right, facing the face
            split = top - spec["step"] * H
            s0, s1 = spec["shaft"]
            parts = [E._box(*(c + ru * (s0 + s1 - 1) / 2 * W), p["bearing"], (s1 - s0) * W, T, base, split),
                     E._box(*c, p["bearing"], W, T, split, top)]
        else:
            parts = E.tpillar(p)
            split = top - E.LOOK["head"] * H
        for k, (vs, fs) in enumerate(parts):
            me = bpy.data.meshes.new(f"pillar {p['number']} {k}")
            me.from_pydata(vs, [], fs)
            me.materials.append(mats["stone"])
            coll.objects.link(bpy.data.objects.new(me.name, me))
        for k in carves:
            h, spec = relief(k["relief"])
            if k["face"] in ("broad", "sides"):
                normals = [n] if k["face"] == "broad" else [n_side, -n_side]
                for nn in normals:
                    ru = np.array([-nn[1], nn[0]])
                    if k.get("right") == "front" and np.dot(ru, f) < 0:
                        ru = -ru                     # mirrored, so the drawing's right is the pillar's front
                    if k.get("outline"):
                        span, z0, z1 = W, top, base
                        s0, s1 = spec["shaft"]
                        keep = lambda u, v, st=spec["step"], s0=s0, s1=s1: (v <= st) | ((u >= s0) & (u <= s1))
                    else:
                        span, z0, z1 = W * E.LOOK["shaft"], split, base
                        keep = lambda u, v: np.ones(np.shape(u), dtype=bool)
                    corner = c - ru * span / 2 + nn * T / 2
                    sheet(f"pillar {p['number']}: {k['relief']}", h, corner, ru, span, z0, z1, nn, keep,
                          mats["stone"], coll, spec.get("raise_m", RELIEF))
            else:   # the narrow front of the shaft, below the head (`inner`: the end facing into the ring)
                nn = -f if k.get("inner") and np.dot(f, ring_centre - c) < 0 else f
                ru = np.array([-nn[1], nn[0]])
                corner = c + nn * W * E.LOOK["shaft"] / 2 - ru * T / 2
                sheet(f"pillar {p['number']}: {k['relief']}", h, corner, ru, T, split, base, nn,
                      lambda u, v: np.ones(np.shape(u), dtype=bool), mats["stone"], coll)
        made[p["number"]] = dict(x=p["x"], y=p["y"], carved=[k["relief"] for k in carves],
                                 face=[float(v) for v in n] if shape else None)
    return made


def materials():
    """The stone, all look choices: the pillars fresh-cut cream limestone over the CC0 worn-rock photograph, the walls
    dry-stone rubble (CC0 `broken_wall`) warmed to the same limestone, the floor the bedrock photograph. Each keeps
    only its photograph's light and dark, laid over its tint."""
    from giza.materials import TEX, image

    def mat(name, role, tint, bump, scale=1.0, rough=0.85):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        N, L = nt.nodes, nt.links
        b = N["Principled BSDF"]
        b.inputs["Roughness"].default_value = rough
        co = N.new("ShaderNodeTexCoord")
        mp = N.new("ShaderNodeMapping")
        t = TEX[role]["tile_m"][0] * scale
        mp.inputs["Scale"].default_value = (1 / t,) * 3
        L.new(co.outputs["Object"], mp.inputs["Vector"])
        di = N.new("ShaderNodeTexImage")
        di.image, di.projection, di.projection_blend = image(role, "Diffuse"), "BOX", 0.25
        hm = N.new("ShaderNodeTexImage")
        hm.image, hm.projection, hm.projection_blend = image(role, "Displacement", True), "BOX", 0.25
        L.new(mp.outputs[0], di.inputs["Vector"])
        L.new(mp.outputs[0], hm.inputs["Vector"])
        bw = N.new("ShaderNodeRGBToBW")
        L.new(di.outputs["Color"], bw.inputs[0])
        rng = N.new("ShaderNodeMapRange")
        rng.inputs[1].default_value, rng.inputs[2].default_value = 0.0, 0.6
        rng.inputs[3].default_value, rng.inputs[4].default_value = 0.45, 1.25
        L.new(bw.outputs[0], rng.inputs[0])
        comb = N.new("ShaderNodeCombineColor")
        for k in range(3):
            L.new(rng.outputs[0], comb.inputs[k])
        mix = N.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix.inputs[6].default_value = tint
        L.new(comb.outputs[0], mix.inputs[7])
        L.new(mix.outputs[2], b.inputs["Base Color"])
        bp = N.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.02
        L.new(hm.outputs["Color"], bp.inputs["Height"])
        L.new(bp.outputs["Normal"], b.inputs["Normal"])
        return m
    return dict(stone=mat("limestone pillars (stand-in)", "core", (0.66, 0.53, 0.36, 1.0), 0.25, 0.6),
                wall=mat("rubble wall (stand-in)", "rubble-wall", (0.56, 0.43, 0.29, 1.0), 0.8, 1.0, 0.95),
                floor=mat("bedrock floor", "bedrock", (0.52, 0.42, 0.30, 1.0), 0.4, 1.0, 0.9))


def walls_and_floor(coll, mats):
    """The ring's wall (the plan's line, at its preserved height) and the bedrock floor inside it, in the plan's frame.
    Returns the wall's outer face, for the ground round it."""
    w = E.wall()
    vs, fs = E.wall_mesh(w)
    me = bpy.data.meshes.new("Enclosure D wall")
    me.from_pydata(vs, [], fs)
    me.materials.append(mats["wall"])
    coll.objects.link(bpy.data.objects.new(me.name, me))
    inner = w["inner"]
    vs = [(x, y, 0.0) for x, y in inner] + [(sum(x for x, _ in inner) / len(inner), sum(y for _, y in inner) / len(inner), 0.0)]
    m = len(inner)
    fs = [(m, i, (i + 1) % m) for i in range(m)]
    me = bpy.data.meshes.new("Enclosure D floor")
    me.from_pydata(vs, [], fs)
    me.materials.append(mats["floor"])
    coll.objects.link(bpy.data.objects.new(me.name, me))
    return w

