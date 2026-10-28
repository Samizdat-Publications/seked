"""
The land round Göbekli Tepe: what makes the hill read as a hill from the air and from the plain (render/gobekli.py).

The heightfield gives the hill its shape; everything here is a look choice laid over it, from photographs of the site
(a dry, golden grass over smooth slopes, the limestone's beds breaking out in grey ledges along the contours, stones
everywhere, lines of planted pines on the ridges, the plain below in pale fields, and a heavy haze):

- `relief`: a little rolling relief under the grass, so the slopes catch the light unevenly;
- `masks`: where the limestone breaks out (bands along the contours, where the slope steepens, in patches) and
  where the grass is thick, as a colour attribute on each ground mesh, which the land's shader reads;
- `rocks`: limestone stones and boulders as instances, thick on the ledges and sparse elsewhere;
- `trees`: today, rows of planted pines along contours on the slopes below the site; about 9500 BCE, a few
  scattered oak, pistachio and almond trees on the gentler ground instead.
"""
import math

import bpy
import numpy as np

BED = 3.5               # m between the limestone beds that break out along the contours
RELIEF = (60.0, 0.8, 8.0, 0.15)   # the rolling relief: a broad term (wavelength, amplitude) and a fine one
_TAB = {}


def value_noise(x, y, scale, seed):
    """Smooth value noise, 0 to 1, on a lattice `scale` metres across."""
    if seed not in _TAB:
        _TAB[seed] = np.random.default_rng(seed).random((256, 256))
    t = _TAB[seed]
    fx, fy = np.asarray(x) / scale, np.asarray(y) / scale
    ix, iy = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
    tx, ty = fx - ix, fy - iy
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = t[iy & 255, ix & 255], t[iy & 255, (ix + 1) & 255]
    c, d = t[(iy + 1) & 255, ix & 255], t[(iy + 1) & 255, (ix + 1) & 255]
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty


def fbm(x, y, scale, octaves=4, seed=0):
    s, w, tot = 0.0, 1.0, 0.0
    for k in range(octaves):
        s = s + w * value_noise(x, y, scale / 2 ** k, seed + 17 * k)
        tot += w
        w *= 0.5
    return s / tot


def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def relief(X, Y, fine=1.0):
    """Metres of rolling relief at X, Y: the broad term everywhere, the fine one scaled by `fine` (0 to 1)."""
    big = (fbm(X, Y, RELIEF[0], 4, 11) - 0.5) * 2 * RELIEF[1]
    return big + fine * (fbm(X, Y, RELIEF[2], 3, 23) - 0.5) * 2 * RELIEF[3]


def masks(X, Y, Z, spacing):
    """(outcrop, grass, detail), each 0 to 1, on a grid: the limestone's ledges where its beds cross the slope, the
    grass thick between them, and a slow variation the shader uses for tone."""
    gy, gx = np.gradient(Z, spacing)
    slope = np.hypot(gx, gy)
    phase = (Z + (fbm(X, Y, 90.0, 3, 31) - 0.5) * 8.0) / BED
    frac = phase - np.floor(phase)
    band = smooth(0.62, 0.80, frac) * (1 - smooth(0.92, 0.99, frac))
    patch = smooth(0.40, 0.60, fbm(X, Y, 45.0, 4, 37))
    steep = smooth(0.05, 0.22, slope)
    outcrop = np.clip(band * patch * steep * 1.6 + smooth(0.35, 0.6, slope) * 0.6, 0.0, 1.0)
    grass = np.clip(smooth(0.30, 0.55, fbm(X, Y, 30.0, 4, 41)) * (1 - outcrop) * (1 - smooth(0.25, 0.5, slope)), 0.0, 1.0)
    detail = fbm(X, Y, 12.0, 3, 43)
    return outcrop, grass, detail


def paint(ob, X, Y, Z, spacing):
    """The masks as the mesh's colour attribute `land` (R outcrop, G grass, B detail), per vertex."""
    o, g, d = masks(X, Y, Z, spacing)
    me = ob.data
    a = me.color_attributes.new("land", "FLOAT_COLOR", "POINT")
    a.data.foreach_set("color", np.c_[o.ravel(), g.ravel(), d.ravel(), np.ones(o.size)].astype(np.float32).ravel())
    return o


def _blob(name, n_sub, rng, squash, rough):
    """An icosphere made lumpy by noise along its normals: a stone, or a tree's crown."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=n_sub, radius=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    seed = int(rng.integers(0, 1000))
    k = 1 + rough * (value_noise(co[:, 0] * 3 + co[:, 2] * 2, co[:, 1] * 3 - co[:, 2], 1.0, seed) - 0.5)
    k = k + 0.5 * rough * (value_noise(co[:, 0] * 9 - co[:, 2] * 5, co[:, 1] * 9 + co[:, 2] * 4, 1.0, seed + 1) - 0.5)
    co = co * k[:, None] * np.array([1.0, rng.uniform(0.7, 1.1), squash])
    me.vertices.foreach_set("co", co.ravel())
    me.shade_smooth()
    return me


def _tree(name, rng, crown_mat, trunk_mat, tall):
    """A tree a metre high: a lumpy crown on a trunk. `tall` (0 to 1) runs from a spreading oak to a pine."""
    import bmesh
    crown = _blob(name + " crown", 2, rng, 0.75 + 0.9 * tall, 0.6 - 0.25 * tall)
    bm = bmesh.new()
    bm.from_mesh(crown)
    lift = 0.55 + 0.1 * tall
    w = 0.95 - 0.5 * tall
    bmesh.ops.scale(bm, vec=(w, w, 0.6 + 0.2 * tall), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, lift), verts=bm.verts)
    for f in bm.faces:
        f.material_index = 0
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.05, radius2=0.03, depth=lift + 0.05)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, (lift + 0.05) / 2 - 0.05), verts=r["verts"])
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = 1
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    bpy.data.meshes.remove(crown)
    me.materials.append(crown_mat)
    me.materials.append(trunk_mat)
    me.shade_smooth()
    return me


def _material(name, colour, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = colour
    b.inputs["Roughness"].default_value = rough
    return m


def variants(name, n, make, mat):
    coll = bpy.data.collections.new(name)            # not linked to the scene: only instanced
    for k in range(n):
        me = make(k)
        if mat is not None:
            me.materials.append(mat)
        coll.objects.link(bpy.data.objects.new(f"{name} {k}", me))
    return coll


def rocks(surface, outcrop_at, exclude, coll, centre, rng, near=(80.0, 60000), far=(700.0, 120000)):
    """Limestone stones, thick on the ledges and sparse elsewhere: a dense field of small ones within near[0] metres of
    `centre`, larger ones out to far[0]. `surface` gives the ground's height, `outcrop_at` the ledge mask there."""
    from giza.instancing import field
    mat = _material("limestone stones", (0.36, 0.33, 0.28, 1.0))
    # faceted and broken, not smooth: rounded they read as eggs on a lawn (the critic, 25 October)
    def stone(k):
        me = _blob(f"stone {k}", 1, rng, rng.uniform(0.45, 0.8), 0.9)
        me.shade_flat()
        return me
    lib = variants("stone variants", 10, stone, mat)
    pos, scl, rot = [], [], []
    for radius, count, size in ((near[0], near[1], (np.log(0.12), 0.7, 0.03, 0.9)),
                                (far[0], far[1], (np.log(0.3), 0.5, 0.12, 1.0))):
        x = centre[0] + rng.uniform(-radius, radius, count * 3)
        y = centre[1] + rng.uniform(-radius, radius, count * 3)
        keep = (rng.random(len(x)) < 0.03 + 0.97 * outcrop_at(x, y)) & ~exclude(x, y)
        x, y = x[keep][:count], y[keep][:count]
        s = np.clip(rng.lognormal(size[0], size[1], len(x)), size[2], size[3])
        pos.append(np.c_[x, y, surface(x, y) + s * 0.12])
        scl.append(np.c_[s * rng.uniform(0.8, 1.6, len(x)), s * rng.uniform(0.8, 1.3, len(x)), s])
        rot.append(np.c_[rng.uniform(-0.3, 0.3, len(x)), rng.uniform(-0.3, 0.3, len(x)), rng.uniform(0, 6.3, len(x))])
    pos, scl, rot = np.concatenate(pos), np.concatenate(scl), np.concatenate(rot)
    n = len(pos)
    return field("stones on the hill", lib, pos, rot, scl, rng.integers(0, 10, n), rng.random(n), np.zeros(n), coll)


def shrubs(surface, outcrop_at, exclude, coll, centre, rng, era, radius=700.0, count=160000):
    """Low clumps of thistle, thorn and dry herbs on the grass, thick near the camera's ground and everywhere off the
    ledges: from a distance they give a hillside its fine dark speckle."""
    from giza.instancing import field
    colour = (0.19, 0.15, 0.08, 1.0) if era == "today" else (0.11, 0.13, 0.05, 1.0)
    mat = _material("shrubs and thistles", colour, 0.95)
    lib = variants("shrub variants", 6, lambda k: _blob(f"shrub {k}", 3, rng, rng.uniform(0.45, 0.7), 1.3), mat)
    x = centre[0] + radius * (2 * rng.random(count * 2) - 1)
    y = centre[1] + radius * (2 * rng.random(count * 2) - 1)
    patch = value_noise(x, y, 25.0, 61)
    keep = (rng.random(len(x)) < patch * (1 - outcrop_at(x, y))) & ~exclude(x, y)
    x, y = x[keep][:count], y[keep][:count]
    n = len(x)
    s = np.clip(rng.lognormal(np.log(0.45), 0.45, n), 0.15, 1.3)
    pos = np.c_[x, y, surface(x, y) + s * 0.1]
    scl = np.c_[s * rng.uniform(0.8, 1.3, n), s * rng.uniform(0.8, 1.3, n), s * 0.7]
    rot = np.c_[np.zeros(n), np.zeros(n), rng.uniform(0, 6.3, n)]
    return field("shrubs and thistles", lib, pos, rot, scl, rng.integers(0, 6, n), rng.random(n), np.zeros(n), coll)


def trees(surface, era, exclude, coll, centre, rng, z_site):
    """Today, lines of planted pines along contours below the site; about 9500 BCE, scattered broadleaf trees."""
    from giza.instancing import field
    if era == "today":
        mat = _material("pine crowns", (0.035, 0.07, 0.035, 1.0), 0.95)
        bark = _material("bark", (0.09, 0.07, 0.05, 1.0))
        lib = variants("pine variants", 4, lambda k: _tree(f"pine {k}", rng, mat, bark, 1.0), None)
        pts = []
        # two rows, a few metres apart, along each of three contours below the site, in arcs to the south and east
        for drop, a0, a1 in ((18.0, 40.0, 140.0), (32.0, 60.0, 160.0), (45.0, 20.0, 110.0)):
            ang = np.radians(np.linspace(a0, a1, 4000))
            for r in np.linspace(150.0, 900.0, 160):
                x, y = centre[0] + r * np.sin(ang), centre[1] + r * np.cos(ang)
                zz = surface(x, y)
                hit = np.abs(zz - (z_site - drop)) < 0.35
                pts.append(np.c_[x[hit], y[hit]])
        p = np.concatenate(pts)
        # thinned to about one tree every 4 m, the two rows by offsetting half of them
        g = np.round(p / 4.0)
        _, idx = np.unique(g, axis=0, return_index=True)
        p = p[idx]
        p = p + rng.normal(0, 0.6, p.shape)
        size = rng.uniform(6.0, 9.0, len(p))
        slim = 0.55
    else:
        x = centre[0] + rng.uniform(-900, 900, 20000)
        y = centre[1] + rng.uniform(-900, 900, 20000)
        keep = value_noise(x, y, 120.0, 51) > 0.55
        p = np.c_[x[keep], y[keep]][:1800]
        size = rng.uniform(4.0, 7.0, len(p))
        slim = 1.0
        # The Giza scenes' broadleaf trees (render/giza/vegetation.py's library) where it is on disk: the procedural
        # crowns read as lollipops on a lawn (the critic, 25 October). Oak and pistachio are what the pollen gives;
        # these stand in for them, a look choice.
        # PlantCatalog's olive and fig (the library's `woodland`) where they were exported, else its broadleaf trees
        vcoll = None
        try:
            from giza import vegetation
            for kind in ("woodland", "broadleaf"):
                got = vegetation.library(coll, kinds=[kind])
                if kind in got:
                    vcoll, heights = got[kind]
                    break
        except Exception as e:                       # no library: the procedural crowns
            print(f"gobekli trees: no vegetation library ({e}); procedural crowns", flush=True)
        if vcoll is not None:
            p = p[~exclude(p[:, 0], p[:, 1])]
            size = size[:len(p)]
            n = len(p)
            var = rng.integers(0, len(heights), n)
            s = size / np.array(heights)[var]
            pos = np.c_[p, surface(p[:, 0], p[:, 1]) - 0.2]
            scl = np.c_[s * rng.uniform(0.85, 1.2, n), s * rng.uniform(0.85, 1.2, n), s]
            rot = np.c_[rng.normal(0, 0.03, n), rng.normal(0, 0.03, n), rng.uniform(0, 6.3, n)]
            return field("trees", vcoll, pos, rot, scl, var, rng.random(n), np.zeros(n), coll)
        mat = _material("oak and pistachio crowns", (0.06, 0.09, 0.035, 1.0), 0.95)
        bark = _material("bark", (0.10, 0.08, 0.06, 1.0))
        lib = variants("tree variants", 4, lambda k: _tree(f"tree {k}", rng, mat, bark, 0.0), None)
    p = p[~exclude(p[:, 0], p[:, 1])]
    size = size[:len(p)]
    n = len(p)
    pos = np.c_[p, surface(p[:, 0], p[:, 1])]
    scl = np.c_[size * slim * rng.uniform(0.8, 1.1, n), size * slim * rng.uniform(0.8, 1.1, n), size]
    rot = np.c_[np.zeros(n), np.zeros(n), rng.uniform(0, 6.3, n)]
    return field("trees", lib, pos, rot, scl, rng.integers(0, 4, n), rng.random(n), np.zeros(n), coll)


def grass(surface, exclude, coll, centre, rng, radius=160.0, count=420000):
    """About 9500 BCE, tufts of the Giza scenes' grass (render/giza/vegetation.py's library) thick round the enclosure
    and thinning out to `radius`: the painted ground alone read as a lawn close to the camera. A look choice."""
    from giza.instancing import field
    try:
        from giza import vegetation
        got = vegetation.library(coll, kinds=["grass", "tussock"])
    except Exception as e:
        print(f"gobekli grass: no vegetation library ({e})", flush=True)
        return None
    out = []
    for kind, share, (h0, h1) in (("grass", 0.85, (0.25, 0.6)), ("tussock", 0.15, (0.35, 0.8))):
        if kind not in got:
            continue
        vcoll, heights = got[kind]
        m = int(count * share)
        r = radius * np.sqrt(rng.random(m * 2)) ** 1.6          # thicker towards the middle
        a = rng.uniform(0, 2 * np.pi, m * 2)
        x, y = centre[0] + r * np.cos(a), centre[1] + r * np.sin(a)
        # patchy, but never bare: the thin patches keep a third of the tufts
        keep = (rng.random(len(x)) < 0.35 + 0.65 * smooth(0.25, 0.6, value_noise(x, y, 6.0, 71))) & ~exclude(x, y)
        x, y = x[keep][:m], y[keep][:m]
        n = len(x)
        var = rng.integers(0, len(heights), n)
        sz = rng.uniform(h0, h1, n) / np.array(heights)[var]
        pos = np.c_[x, y, surface(x, y) - 0.02]
        scl = np.c_[sz * rng.uniform(0.8, 1.3, n), sz * rng.uniform(0.8, 1.3, n), sz]
        rot = np.c_[rng.normal(0, 0.12, n), rng.normal(0, 0.12, n), rng.uniform(0, 6.3, n)]
        out.append(field(f"{kind} round the enclosure", vcoll, pos, rot, scl, var, rng.random(n),
                         rng.uniform(0.15, 0.5, n), coll))
    return out
