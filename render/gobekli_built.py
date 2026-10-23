"""
Göbekli Tepe about 9500 BCE: Enclosure D as built, set into its hill (render/gobekli.py --era 9500).

The ring is the plan's stand-in (render/giza/enclosure_d.py: pillar positions and widths scaled from Haklay & Gopher
2020 Fig. 1, the central pair's height and pedestals and the wall's height printed on its p. 347), moved into the
site frame where the scan's registration puts Enclosure D (build/models/gobekli-site-rmark/fit.json), its floor at
the scan's floor there. The plan's wall pillars carry the excavators' numbers, matched by angle to their numbered
plan (docs/gobekli-reliefs.md): a look choice.

Three faces are carved from the cleaned height maps (assets/gobekli-reliefs, scripts/gobekli_reliefs.py): Pillar 43's broad face, and
Pillar 18's broad sides and narrow front, which stand in for Pillar 31's as well until its own are drawn. Each is a
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
RELIEF = 0.04            # m: the carving's greatest raise (Göbekli's reliefs are mostly low, a few centimetres)
GRID = 0.01              # m: the carved sheet's spacing
# what is carved where: `broad` the broad face nearer `facing` (a bearing), or `sides` both broad faces, or `front`
# the narrow end the pillar's axis points to; `right` what the drawing has on its right: the pillar's "front" (the
# end its axis points to) or its "inner" end (towards the ring's middle)
CARVED = {
    "43": [dict(relief="p43-front", face="broad", facing=210.0, right="inner", outline=True)],
    "18": [dict(relief="p18-side", face="sides", right="front"), dict(relief="p18-front", face="front")],
    "31": [dict(relief="p18-side", face="sides", right="front"), dict(relief="p18-front", face="front")],
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


def sheet(name, h, corner, ru, width, z_top, z_bottom, normal, keep, mat, coll):
    """A carved face: a GRID-spaced sheet from `corner` (its top left, in plan x, y) `width` metres along `ru` and down
    from z_top to z_bottom, standing out along `normal` by the relief's height. Only the quads that carry relief (and
    a cell round them) are kept, and only those `keep(u, v)` allows."""
    nu = max(2, int(round(width / GRID)) + 1)
    nv = max(2, int(round((z_top - z_bottom) / GRID)) + 1)
    u, v = np.meshgrid(np.linspace(0, 1, nu), np.linspace(0, 1, nv))
    hh = lookup(h, u, v)
    off = 0.003 + RELIEF * hh
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
            n = n_side if np.dot(n_side, unit(shape["facing"])) > 0 else -n_side
            ru = np.array([-n[1], n[0]])             # the viewer's right, facing the face
            inner = ring_centre - c
            if np.dot(ru, inner) < 0:
                ru = -ru                             # the drawing's right is the inner end
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
                    want = (ring_centre - c) if k["right"] == "inner" else f
                    if np.dot(ru, want) < 0:
                        ru, flip = -ru, True
                    if k.get("outline"):
                        span, z0, z1 = W, top, base
                        s0, s1 = spec["shaft"]
                        keep = lambda u, v, st=spec["step"], s0=s0, s1=s1: (v <= st) | ((u >= s0) & (u <= s1))
                    else:
                        span, z0, z1 = W * E.LOOK["shaft"], split, base
                        keep = lambda u, v: np.ones(np.shape(u), dtype=bool)
                    corner = c - ru * span / 2 + nn * T / 2
                    sheet(f"pillar {p['number']}: {k['relief']}", h, corner, ru, span, z0, z1, nn, keep,
                          mats["stone"], coll)
            else:   # the narrow front of the shaft, below the head
                nn = f
                ru = np.array([-nn[1], nn[0]])
                corner = c + f * W * E.LOOK["shaft"] / 2 - ru * T / 2
                sheet(f"pillar {p['number']}: {k['relief']}", h, corner, ru, T, split, base, nn,
                      lambda u, v: np.ones(np.shape(u), dtype=bool), mats["stone"], coll)
        made[p["number"]] = dict(x=p["x"], y=p["y"], carved=[k["relief"] for k in carves])
    return made


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
