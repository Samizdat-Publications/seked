"""
Göbekli Tepe today: the photogrammetry scan of the main excavation on its hill.

    blender -b --factory-startup -P render/gobekli.py -- [--view rim|air|hill|shelter|all] [--roof on|off]
        [--size 1600x900] [--samples 64] [--exposure -0.5] [--out DIR]

The scan (blender/models.json `gobekli-site-rmark`, rmark, CC BY 4.0) is placed by scripts/gobekli_register.py's
fit (build/models/gobekli-site-rmark/fit.json): scaled and turned onto Enclosure D's plan by its 13 pillars (rms
about 0.5 m, the plan's own sigma), set in the site frame under OpenStreetMap's outline of the main shelter, its
rim on the GLO-30 heightfield (data/terrain/gobekli-glo30, 10 m, out to 1.5 km), which the 60 m heightfield
(gobekli-glo30-far) carries out to 15 km and a stand-in plain to the horizon. The heightfield is bent to the scan's
rim round the excavation, set under the scan and eased onto its edge, so the excavation is the scan's own. The two
modern shelters stand on their OSM outlines when drawn (`--roof on`; the scan alone is the default); their form and
height are read from photographs. The sun, the sky, the grass, the outcrops and the fields are look choices. A
visual stand-in: nothing of the scan's form is a measurement. Frame: metres, +x east, +y north, +z up, origin at
the UNESCO point (data/sites.json gobekli-tepe).
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
sys.path.insert(0, HERE)                        # giza/, gobekli_land, gobekli_built
MODEL = os.path.join(REPO, "build", "models", "gobekli-site-rmark")
TERRAIN = os.path.join(REPO, "data", "terrain", "gobekli-glo30")
FAR = os.path.join(REPO, "data", "terrain", "gobekli-glo30-far")
SUN = {"altitude": 32.0, "azimuth": 235.0}      # a late October afternoon (look choice)
SUN_9500 = {"altitude": 14.0, "azimuth": 120.0}   # before the tell: a low morning sun from the south-east, raking across
                                                # the central pillars' fronts and the Vulture Stone (look choice)
SKY = 0.12                                      # the physical sky's strength beside the sun lamp (look choice)
EXPOSURE = -0.5
GROUND = (0.20, 0.135, 0.085, 1.0)             # the Harran plain's dry red-brown soil after the harvest (look choice)
ERA = ["today"]                                 # set by main: which era's land the shader draws
GRASS = {"today": ((0.56, 0.38, 0.12, 1.0), (0.42, 0.28, 0.09, 1.0)),      # straw, after the summer (look choice)
         "9500": ((0.42, 0.37, 0.14, 1.0), (0.30, 0.29, 0.11, 1.0))}       # an early Holocene spring steppe, greener
GRASS["8000"] = GRASS["9500"]
FIELDS = {"today": [(0.0, (0.46, 0.39, 0.27)), (0.30, (0.52, 0.45, 0.32)), (0.55, (0.33, 0.25, 0.17)),
                    (0.75, (0.44, 0.37, 0.26)), (0.93, (0.16, 0.19, 0.08))],
          # no fields before farming: the plain's own steppe, a little greener in its hollows
          "9500": [(0.0, (0.30, 0.31, 0.14)), (0.4, (0.36, 0.34, 0.17)), (0.75, (0.26, 0.28, 0.12))]}
FIELDS["8000"] = FIELDS["9500"]
HAZE = ((0.66, 0.70, 0.76, 1.0), 0.55)         # the haze's colour and light (look choice, from photographs)
HAZE_M = 15000.0                                # m over which the land fades about two thirds of the way into it
CELL = 0.5                                      # m: the scan's footprint is rastered at this, and the near ground too
UNDER = 0.5                                     # m the ground drops below the scan's lowest point in each cell it covers
GLUE = 20.0                                     # m outside the scan over which the ground eases onto the scan's rim
SKIRT_HIDE = 5.0                                # m the land beyond sits under the 15 km heightfield where they overlap
SKIRT = 60000.0                                 # m: the flat plain beyond the 15 km heightfield, to the horizon
FIT_R = (40.0, 150.0)
FILL_BELOW_TOP = 0.25                           # m: the 8000 BCE fill stands this far under the wall's top (look choice)
TELL = (40.0, 160.0)                            # m from Enclosure D: the later mound taken off within, eased out to                           # m from the excavation over which the heightfield is bent to its rim
NEAR = (80.0, CELL)                            # half-width and spacing of the finer ground round the excavation
# The two shelters (2016 to 2018, EiSat GmbH with kleyer.koblitz.letzel.freivogel; steel and membrane). Their outlines
# are OpenStreetMap's (traced from Maxar imagery, so the canopy edge as seen from above); their heights and the
# spacing of their legs are read by eye from photographs on Wikimedia Commons: look choices, not measurements.
SHELTERS = {502057666: "main shelter (enclosures A to D)", 856868911: "north-western shelter"}
EAVE = 8.5                                      # m the canopy's edge stands above the ground at its outline
RISE = 2.0                                      # m its top domes above the edge at the middle
LIP = 0.6                                       # m: half the rolled edge's thickness
LEG_STEP = 9.0                                  # m between the legs' heads along the edge
LEG_IN = 2.5                                    # m the legs' feet stand inside the edge
WALK = (4.0, 2.4, 1.2)                          # the walkway: inset from the edge, width, height above the ground


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return dict(zip(argv[::2], argv[1::2]))


def heightfield():
    hdr = json.load(open(TERRAIN + ".json", encoding="utf-8"))
    z = np.fromfile(TERRAIN + ".f32", dtype="<f4").reshape(hdr["ny"], hdr["nx"])
    return hdr, z


def sample(hdr, z, x, y):
    fx = (np.asarray(x) - hdr["x0"]) / hdr["spacing"]
    fy = (np.asarray(y) - hdr["y0"]) / hdr["spacing"]
    i0 = np.clip(np.floor(fx).astype(int), 0, hdr["nx"] - 2)
    j0 = np.clip(np.floor(fy).astype(int), 0, hdr["ny"] - 2)
    tx, ty = fx - i0, fy - j0
    return (z[j0, i0] * (1 - tx) * (1 - ty) + z[j0, i0 + 1] * tx * (1 - ty)
            + z[j0 + 1, i0] * (1 - tx) * ty + z[j0 + 1, i0 + 1] * tx * ty)


def place_scan(fit):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODEL, "model.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new("Göbekli Tepe scan (rmark, CC BY 4.0)", None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    s = fit["scale_m_per_unit"]
    dx, dy = fit["enclosure_d_in_site"]
    root.scale = (s, s, s)
    root.rotation_euler = (0.0, 0.0, math.radians(fit["rotation_deg"]))
    root.location = (fit["t_east"] + dx, fit["t_north"] + dy, 0.0)
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == "MESH"]
    return root, meshes


def footprint(meshes, keep=4000):
    """The scan's vertices in the site frame, thinned to about `keep` a mesh: for the rim, the ground and the camera."""
    pts = []
    for o in meshes:
        n = len(o.data.vertices)
        co = np.empty(n * 3)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)[:: max(1, n // keep)]
        mw = np.array(o.matrix_world)
        pts.append(co @ mw[:3, :3].T + mw[:3, 3])
    return np.concatenate(pts)


def shift(a, dj, di):
    return np.roll(np.roll(a, dj, axis=0), di, axis=1)


EIGHT = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))


def scan_raster(pts, centre):
    """The scan's footprint on the near ground's grid: per cell its lowest and highest point, and which cells it
    covers (pinholes closed). Rows run north, columns east, as the grid's."""
    half = NEAR[0]
    n = int(round(2 * half / CELL)) + 1
    i = np.round((pts[:, 0] - (centre[0] - half)) / CELL).astype(int)
    j = np.round((pts[:, 1] - (centre[1] - half)) / CELL).astype(int)
    ok = (i >= 0) & (i < n) & (j >= 0) & (j < n)
    i, j, zz = i[ok], j[ok], pts[ok, 2]
    lo = np.full((n, n), np.inf)
    hi = np.full((n, n), -np.inf)
    np.minimum.at(lo, (j, i), zz)
    np.maximum.at(hi, (j, i), zz)
    have = np.isfinite(lo)
    # a cell the scan surrounds on most sides is under it too
    near = sum(shift(have, dj, di).astype(int) for dj, di in EIGHT)
    fill = ~have & (near >= 5)
    for dj, di in EIGHT:
        lo[fill] = np.minimum(lo[fill], shift(lo, dj, di)[fill])
        hi[fill] = np.maximum(hi[fill], shift(hi, dj, di)[fill])
    return lo, hi, have | fill


def glue(Z, lo, hi, have, reach=GLUE):
    """The near ground under and round the scan: under it, UNDER below its lowest point; outside, eased over `reach`
    metres onto the height of the scan's nearest rim, so no cliff or gap stands at its edge."""
    Z = Z.copy()
    Z[have] = np.minimum(Z[have], lo[have] - UNDER)
    cur, val = have.copy(), np.where(have, hi, 0.0)
    dist = np.where(have, 0.0, np.inf)
    for k in range(1, int(reach / CELL) + 1):
        acc, cnt = np.zeros_like(Z), np.zeros_like(Z)
        for dj, di in EIGHT:
            c = shift(cur, dj, di)
            acc += np.where(c, shift(val, dj, di), 0.0)
            cnt += c
        new = ~cur & (cnt > 0)
        val[new] = acc[new] / cnt[new]
        dist[new] = k * CELL
        cur |= new
    # the rim's heights carried outwards are smoothed across, so they do not run out in streaks
    for _ in range(8):
        sm = sum(np.where(shift(cur, dj, di), shift(val, dj, di), 0.0) for dj, di in EIGHT) + 4 * val
        n = sum(shift(cur, dj, di).astype(float) for dj, di in EIGHT) + 4
        val = np.where(cur & ~have, sm / n, val)
    w = np.clip(1 - dist / reach, 0.0, 1.0)
    w = w * w * (3 - 2 * w)
    out = ~have & (w > 0)
    Z[out] = Z[out] * (1 - w[out]) + (val[out] - 0.1) * w[out]
    return Z


def grid(x0, x1, y0, y1, sp):
    return np.meshgrid(np.arange(x0, x1 + 1e-6, sp), np.arange(y0, y1 + 1e-6, sp))


def grid_object(name, X, Y, Z, hole, m, coll):
    """A height grid as one smooth mesh, leaving out the quads wholly inside `hole`."""
    ny_, nx_ = X.shape
    drop = hole(X, Y).ravel() if hole else np.zeros(X.size, dtype=bool)
    j, i = np.mgrid[0:ny_ - 1, 0:nx_ - 1]
    a = (j * nx_ + i).ravel()
    quads = np.c_[a, a + 1, a + nx_ + 1, a + nx_]
    quads = quads[~drop[quads].all(axis=1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.c_[X.ravel(), Y.ravel(), Z.ravel()].tolist(), [], quads.tolist())
    me.shade_smooth()
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def terrain_mesh(hdr, z, near, coll, centre, have):
    """The land as four nested grids, each with a hole where the next finer one lies: a flat skirt at the plain's
    height out to SKIRT metres, the 60 m heightfield (GLO-30, data/terrain/gobekli-glo30-far) out to 15 km, the 10 m
    one out to 1.5 km, and a CELL grid round the excavation, set under and round the scan by `near`. The three
    inner grids meet edge to edge on shared grid lines (`centre` is a whole number of 10 m steps), each finer one
    eased onto the coarser one's surface at its border, so no seam or step opens between them; the skirt is the
    one overlap, tucked SKIRT_HIDE metres under. Over the 10 m and the near grids lies the land's rolling relief, its
    fine part only on the near grid and faded out at its border, and each grid carries the land's masks
    (render/gobekli_land.py). Returns the ground's height and its ledge mask as functions of x, y, and which points
    the excavation or the enclosure covers (`have` on the near grid), for the stones and trees."""
    import gobekli_land as LAND
    half, step = NEAR
    m = soil()
    fh = json.load(open(FAR + ".json", encoding="utf-8"))
    fz = np.fromfile(FAR + ".f32", dtype="<f4").reshape(fh["ny"], fh["nx"])
    fsp = fh["spacing"]
    FX, FY = grid(fh["x0"], fh["x0"] + (fh["nx"] - 1) * fsp, fh["y0"], fh["y0"] + (fh["ny"] - 1) * fsp, fsp)
    # the far grid takes the bent near heightfield where they overlap, so the two agree at their seam
    r = hdr["x0"] + (hdr["nx"] - 1) * hdr["spacing"]
    inner = (abs(FX) <= r) & (abs(FY) <= r)
    FZ = fz.astype(float)
    FZ[inner] = sample(hdr, z, FX[inner], FY[inner])
    ob = grid_object("land (GLO-30, 60 m)", FX, FY, FZ, lambda x, y: (abs(x) <= r + 1e-6) & (abs(y) <= r + 1e-6), m, coll)
    LAND.paint(ob, FX, FY, FZ, fsp)
    # beyond it, its own edge carried outwards and eased to the edge's median height: a stand-in plain to the horizon
    edge = np.r_[fz[0], fz[-1], fz[:, 0], fz[:, -1]]
    R = fh["x0"] + (fh["nx"] - 1) * fsp
    SX, SY = grid(-SKIRT, SKIRT, -SKIRT, SKIRT, SKIRT / 100)
    out = np.maximum(abs(SX), abs(SY)) - R
    w = np.clip(out / (0.5 * SKIRT), 0.0, 1.0)
    SZ = sample(fh, fz, np.clip(SX, -R, R), np.clip(SY, -R, R)) * (1 - w) + float(np.median(edge)) * w
    ob = grid_object("land beyond (look choice)", SX, SY, SZ - SKIRT_HIDE,
                     lambda x, y: (abs(x) < R - SKIRT / 100) & (abs(y) < R - SKIRT / 100), m, coll)
    LAND.paint(ob, SX, SY, SZ, SKIRT / 100)
    nx, ny, sp = hdr["nx"], hdr["ny"], hdr["spacing"]
    X, Y = grid(hdr["x0"], hdr["x0"] + (nx - 1) * sp, hdr["y0"], hdr["y0"] + (ny - 1) * sp, sp)
    fhb = dict(fh, ny=FZ.shape[0], nx=FZ.shape[1])
    w = np.clip(1 - (r - np.maximum(abs(X), abs(Y))) / (2 * fsp), 0.0, 1.0)
    w = w * w * (3 - 2 * w)
    Z = (z + LAND.relief(X, Y, 0.0)) * (1 - w) + sample(fhb, FZ, X, Y) * w
    ob = grid_object("hill (GLO-30, 10 m)", X, Y, Z,
                     lambda x, y: (abs(x - centre[0]) <= half + 1e-6) & (abs(y - centre[1]) <= half + 1e-6), m, coll)
    O = LAND.paint(ob, X, Y, Z, sp)
    X2, Y2 = grid(centre[0] - half, centre[0] + half, centre[1] - half, centre[1] + half, step)
    fine = np.clip((half - np.maximum(abs(X2 - centre[0]), abs(Y2 - centre[1]))) / 10.0, 0.0, 1.0)
    Z2 = near(sample(hdr, z, X2, Y2) + LAND.relief(X2, Y2, fine))
    ob = grid_object("hill round the excavation", X2, Y2, Z2, None, m, coll)
    O2 = LAND.paint(ob, X2, Y2, Z2, step)
    g10 = dict(x0=hdr["x0"], y0=hdr["y0"], spacing=sp, nx=nx, ny=ny)
    g2 = dict(x0=centre[0] - half, y0=centre[1] - half, spacing=step, nx=X2.shape[1], ny=X2.shape[0])
    def on_near(x, y):
        return (abs(x - centre[0]) < half - step) & (abs(y - centre[1]) < half - step)
    def surface(x, y):
        return np.where(on_near(x, y), sample(g2, Z2, x, y), sample(g10, Z, x, y))
    def outcrop(x, y):
        return np.where(on_near(x, y), sample(g2, O2, x, y), sample(g10, O, x, y))
    def covered(x, y):
        i = np.clip(np.round((x - g2["x0"]) / step).astype(int), 0, g2["nx"] - 1)
        j = np.clip(np.round((y - g2["y0"]) / step).astype(int), 0, g2["ny"] - 1)
        grown = have | np.logical_or.reduce([shift(have, dj * 2, di * 2) for dj, di in EIGHT])
        return on_near(x, y) & grown[j, i]
    return surface, outcrop, covered


def soil():
    """The land's surface, all look choices over the heightfield's shape. Near the camera, the CC0 scan of dry ground
    strewn with limestone chips (Poly Haven, blender/textures.json role `gravel`) at two scales, tinted towards the
    Harran soil, with its relief as a bump; far off, where that tile would only repeat, its average colour. Over it, in
    slow patches on gentle ground, the hill's dry golden grass of late October; pale limestone where the ground is
    steeper; and on the low plain, fields cut by a Voronoi pattern, ploughed, in stubble or green with irrigated
    cotton (the Harran plain is watered from the Ataturk dam's canals)."""
    sys.path.insert(0, HERE)
    from giza.materials import TEX, image
    m = bpy.data.materials.new("Harran land")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.95
    b.inputs["Specular IOR Level"].default_value = 0.12   # dry ground: no sky sheen at grazing angles

    def put(sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            L.new(v, sock)

    def mix(fac, a, c, blend="MIX"):
        n = N.new("ShaderNodeMix")
        n.data_type, n.blend_type = "RGBA", blend
        put(n.inputs[0], fac); put(n.inputs[6], a); put(n.inputs[7], c)
        return n.outputs[2]

    def rng(v, a, c, lo=0.0, hi=1.0):
        n = N.new("ShaderNodeMapRange")
        n.interpolation_type = "SMOOTHSTEP"
        n.inputs[1].default_value, n.inputs[2].default_value = a, c
        n.inputs[3].default_value, n.inputs[4].default_value = lo, hi
        L.new(v, n.inputs[0])
        return n.outputs[0]

    def noise(scale, detail=4.0):
        n = N.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value, n.inputs["Detail"].default_value = scale, detail
        L.new(co, n.inputs["Vector"])
        return n.outputs["Fac"]

    def mul(a, c):
        n = N.new("ShaderNodeMath")
        n.operation = "MULTIPLY"
        put(n.inputs[0], a); put(n.inputs[1], c)
        return n.outputs[0]

    def grey(v):
        n = N.new("ShaderNodeCombineColor")
        for k in range(3):
            put(n.inputs[k], v)
        return n.outputs[0]

    def tex(scale, rot, role="gravel", kind="Diffuse", nc=False):
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / scale,) * 3
        mp.inputs["Rotation"].default_value = (0.0, 0.0, rot)
        L.new(co, mp.inputs["Vector"])
        im = N.new("ShaderNodeTexImage")
        im.image, im.projection, im.projection_blend = image(role, kind, nc), "BOX", 0.3
        L.new(mp.outputs[0], im.inputs["Vector"])
        return im.outputs["Color"]

    co = N.new("ShaderNodeTexCoord").outputs["Object"]
    sep = N.new("ShaderNodeSeparateXYZ"); L.new(co, sep.inputs[0])
    nz = N.new("ShaderNodeSeparateXYZ"); L.new(N.new("ShaderNodeNewGeometry").outputs["Normal"], nz.inputs[0])
    near = rng(N.new("ShaderNodeCameraData").outputs["View Distance"], 60.0, 500.0, 1.0, 0.0)
    # the gravel scan at two scales under a slow noise, so its tile does not repeat; far off, its average colour
    t = TEX["gravel"]["tile_m"][0]
    gravel = mix(noise(0.08), tex(t, 0.0), tex(2.7 * t, 0.7))
    lum = N.new("ShaderNodeRGBToBW"); L.new(gravel, lum.inputs[0])
    soil_near = mix(1.0, gravel, (GROUND[0] * 3.2, GROUND[1] * 3.2, GROUND[2] * 3.2, 1.0), "MULTIPLY")
    soil_col = mix(near, GROUND, soil_near)
    # the masks painted on the ground (render/gobekli_land.py): R the limestone's ledges, G thick grass, B a slow tone
    land = N.new("ShaderNodeAttribute"); land.attribute_name = "land"
    lsep = N.new("ShaderNodeSeparateColor"); L.new(land.outputs["Color"], lsep.inputs[0])
    gm, om, tone = lsep.outputs[1], lsep.outputs[0], lsep.outputs[2]
    # the grass: golden and dry today, greener in an early Holocene spring; varied at two scales, grained by the
    # gravel near the camera; thin grass lets the soil through
    g0, g1 = GRASS[ERA[0]]
    gcol = mix(tone, g0, g1)
    gcol = mix(noise(0.6, 2.0), gcol, mix(1.0, gcol, (0.8, 0.8, 0.8, 1.0), "MULTIPLY"))
    grain = grey(rng(lum.outputs[0], 0.0, 0.5, 0.55, 1.3))
    grass = mix(1.0, gcol, mix(near, (1.0, 1.0, 1.0, 1.0), grain), "MULTIPLY")
    thin = mix(0.55, soil_col, grass)
    c1 = mix(gm, thin, grass)
    # the limestone's grey ledges
    lime = mix(near, (0.42, 0.38, 0.31, 1.0), mix(1.0, tex(4.0, 0.3, "core"), (1.05, 1.0, 0.92, 1.0), "MULTIPLY"))
    # broken into rocky fragments, not smooth patches
    c2 = mix(mul(om, rng(noise(0.45, 4.0), 0.38, 0.62)), c1, lime)
    # fields on the low plain: Voronoi cells about 260 m across, most pale and harvested, some ploughed, few green
    flat = N.new("ShaderNodeCombineXYZ")
    L.new(sep.outputs["X"], flat.inputs["X"]); L.new(sep.outputs["Y"], flat.inputs["Y"])
    vo = N.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 1 / 260.0
    L.new(flat.outputs[0], vo.inputs["Vector"])
    ramp = N.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
    crops = FIELDS[ERA[0]]
    el = ramp.color_ramp.elements
    for k, (pp, cc) in enumerate(crops):
        e = el[k] if k < 2 else el.new(pp)
        e.position, e.color = pp, (*cc, 1.0)
    cr = N.new("ShaderNodeSeparateColor"); L.new(vo.outputs["Color"], cr.inputs[0])
    L.new(cr.outputs[0], ramp.inputs[0])
    field = mix(noise(0.05, 2.0), ramp.outputs[0], mix(1.0, ramp.outputs[0], (0.85, 0.85, 0.85, 1.0), "MULTIPLY"))
    fm = mul(rng(sep.outputs["Z"], 640.0, 600.0), rng(nz.outputs["Z"], 0.96, 0.99))
    c3 = mix(fm, c2, field)
    # a slow mottle over everything, so no stretch of land is one colour
    L.new(mix(1.0, c3, grey(rng(noise(0.004, 3.0), 0.35, 0.65, 0.85, 1.1)), "MULTIPLY"), b.inputs["Base Color"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Distance"].default_value = 0.05
    L.new(mul(near, 0.6), bump.inputs["Strength"])
    L.new(tex(t, 0.0, "gravel", "Displacement", True), bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    # the haze: the land fades towards the haze's own light with distance, 1 - exp(-d / HAZE_M)
    d = N.new("ShaderNodeCameraData").outputs["View Distance"]
    k = N.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = -1.0 / HAZE_M
    L.new(d, k.inputs[0])
    e = N.new("ShaderNodeMath"); e.operation = "EXPONENT"; L.new(k.outputs[0], e.inputs[0])
    f = N.new("ShaderNodeMath"); f.operation = "SUBTRACT"; f.inputs[0].default_value = 1.0; L.new(e.outputs[0], f.inputs[1])
    em = N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = HAZE[0]; em.inputs["Strength"].default_value = HAZE[1]
    ms = N.new("ShaderNodeMixShader")
    L.new(f.outputs[0], ms.inputs[0]); L.new(b.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], N["Material Output"].inputs["Surface"])
    return m


def resample(poly, n):
    """A closed outline as n points evenly spaced along it, lightly smoothed, counter-clockwise."""
    p = poly[:-1] if np.allclose(poly[0], poly[-1]) else poly
    if np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]) < 0:
        p = p[::-1]
    q = np.vstack([p, p[:1]])
    s = np.r_[0.0, np.cumsum(np.hypot(*np.diff(q, axis=0).T))]
    t = np.linspace(0.0, s[-1], n, endpoint=False)
    out = np.c_[np.interp(t, s, q[:, 0]), np.interp(t, s, q[:, 1])]
    for _ in range(3):
        out = (np.roll(out, 1, 0) + 2 * out + np.roll(out, -1, 0)) / 4
    return out


def inset(ring, d):
    """The ring moved d metres inwards along its normals (outwards for negative d)."""
    tan = np.roll(ring, -1, 0) - np.roll(ring, 1, 0)
    nrm = np.c_[-tan[:, 1], tan[:, 0]] / np.hypot(*tan.T)[:, None]     # left of a counter-clockwise ring: inwards
    return ring + d * nrm


def mesh_object(name, verts, faces, mats, coll, mat_index=None, smooth=True):
    import bmesh
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for m in mats:
        me.materials.append(m)
    if mat_index is not None:
        me.polygons.foreach_set("material_index", mat_index)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def principled(name, colour, rough, metal=0.0, translucent=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = colour
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if translucent:
        tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
        tr.inputs["Color"].default_value = colour
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = translucent
        out = nt.nodes["Material Output"]
        nt.links.new(b.outputs[0], mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def membrane(name, colour, seam, translucent):
    """The canopy's membrane on a square grid of seams and cables, lit through from the sun (photographs, look
    choice): ivory and glowing underneath, white on top."""
    m = principled(name, colour, 0.6, translucent=translucent)
    nt = m.node_tree
    co = nt.nodes.new("ShaderNodeTexCoord")
    sx = nt.nodes.new("ShaderNodeSeparateXYZ")
    cx = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(co.outputs["Object"], sx.inputs[0])
    nt.links.new(sx.outputs["X"], cx.inputs["X"])
    nt.links.new(sx.outputs["Y"], cx.inputs["Y"])
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = 2.4
    br.inputs["Row Height"].default_value = 2.4
    br.inputs["Mortar Size"].default_value = 0.05
    br.inputs["Color1"].default_value = br.inputs["Color2"].default_value = colour
    br.inputs["Mortar"].default_value = seam
    nt.links.new(cx.outputs[0], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


def shelter(name, poly, hdr, z, coll, mats):
    """One shelter: a domed membrane canopy with a rolled edge on the OSM outline, steel legs in V pairs from feet
    inside the edge up to its underside, and a walkway with railings round the inside (look choices from photographs)."""
    top, under, steel, deck = mats
    n = max(96, int(len(poly) * 3))
    ring = resample(poly, n)
    c = ring.mean(axis=0)
    base = float(np.median(sample(hdr, z, ring[:, 0], ring[:, 1])))
    eave = base + EAVE
    M = 14
    verts, faces, mi = [], [], []
    def add_ring(t, zz, out=0.0):
        p = c + t * (inset(ring, -out) - c) if out else c + t * (ring - c)
        verts.extend(np.c_[p, np.full(n, zz)].tolist())
    # top: from near the middle out to the edge; the rolled edge; the underside back in
    ts = np.linspace(0.08, 1.0, M)
    rings = []
    for t in ts:
        add_ring(t, eave + LIP + RISE * (1 - t * t)); rings.append(0)
    add_ring(1.0, eave, out=0.5); rings.append(0)
    for t in ts[::-1]:
        add_ring(t, eave - LIP + (RISE - 0.6) * (1 - t * t)); rings.append(1)
    R = len(rings)
    for r in range(R - 1):
        for k in range(n):
            a, b = r * n + k, r * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
            mi.append(rings[r + 1] if r + 1 < R and rings[r] == rings[r + 1] else 0)
    # caps at the middle
    ct = len(verts); verts.append([c[0], c[1], eave + LIP + RISE])
    cb = len(verts); verts.append([c[0], c[1], eave - LIP + RISE - 0.6])
    for k in range(n):
        faces.append((ct, (k + 1) % n, k)); mi.append(0)
        last = (R - 1) * n
        faces.append((cb, last + k, last + (k + 1) % n)); mi.append(1)
    mesh_object(f"{name}: canopy", verts, faces, [top, under], coll, mi)
    # legs: heads every LEG_STEP along the edge's underside, each foot between two heads, inside the edge
    per = np.hypot(*np.diff(np.vstack([ring, ring[:1]]), axis=0).T).sum()
    k_heads = np.linspace(0, n, max(6, int(per / LEG_STEP)), endpoint=False).astype(int)
    head = ring[k_heads]
    curve = bpy.data.curves.new(f"{name}: legs", "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", 0.16, 2
    def strut(a, b):
        sp = curve.splines.new("POLY")
        sp.points.add(1)
        sp.points[0].co = (*a, 1.0)
        sp.points[1].co = (*b, 1.0)
    feet = inset(ring, LEG_IN)
    for h in range(len(k_heads)):
        k0, k1 = k_heads[h], k_heads[(h + 1) % len(k_heads)]
        km = (k0 + ((k1 - k0) % n) // 2) % n
        f = feet[km]
        fz = float(sample(hdr, z, f[0], f[1])) - 0.3
        for kk in (k0, k1):
            strut((f[0], f[1], fz), (ring[kk][0], ring[kk][1], eave - LIP + 0.1))
    curve.materials.append(steel)
    coll.objects.link(bpy.data.objects.new(curve.name, curve))
    # the walkway: a deck ribbon, its railings, and posts down to the ground
    w_in, w_w, w_h = WALK
    edge_o, edge_i = inset(ring, w_in), inset(ring, w_in + w_w)
    dz = base + w_h
    v = np.r_[np.c_[edge_o, np.full(n, dz)], np.c_[edge_i, np.full(n, dz)],
              np.c_[edge_o, np.full(n, dz - 0.25)], np.c_[edge_i, np.full(n, dz - 0.25)]]
    f = []
    for k in range(n):
        k1 = (k + 1) % n
        f += [(k, k1, n + k1, n + k), (2 * n + k, 3 * n + k, 3 * n + k1, 2 * n + k1),
              (k, 2 * n + k, 2 * n + k1, k1), (n + k, n + k1, 3 * n + k1, 3 * n + k)]
    mesh_object(f"{name}: walkway", v, f, [deck], coll, smooth=False)
    rail = bpy.data.curves.new(f"{name}: railings", "CURVE")
    rail.dimensions, rail.bevel_depth = "3D", 0.03
    for e in (edge_o, edge_i):
        for hgt in (1.05, 0.55):
            sp = rail.splines.new("POLY")
            sp.points.add(n - 1)
            for k in range(n):
                sp.points[k].co = (e[k][0], e[k][1], dz + hgt, 1.0)
            sp.use_cyclic_u = True
        for k in range(0, n, 2):
            sp = rail.splines.new("POLY"); sp.points.add(1)
            sp.points[0].co = (e[k][0], e[k][1], dz, 1.0)
            sp.points[1].co = (e[k][0], e[k][1], dz + 1.05, 1.0)
    for k in range(0, n, 6):
        m_ = (edge_o[k] + edge_i[k]) / 2
        sp = rail.splines.new("POLY"); sp.points.add(1)
        sp.points[0].co = (m_[0], m_[1], float(sample(hdr, z, m_[0], m_[1])) - 4.0, 1.0)
        sp.points[1].co = (m_[0], m_[1], dz - 0.25, 1.0)
    rail.materials.append(steel)
    coll.objects.link(bpy.data.objects.new(rail.name, rail))
    return {"base": base, "eave": eave, "legs": len(k_heads) * 2, "perimeter_m": float(per)}


def world_and_sun(sc, SUN=SUN, warm=(1.0, 1.0, 1.0)):
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    nt = w.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(SUN["altitude"])
    sky.sun_rotation = math.radians(SUN["azimuth"])
    sky.sun_disc = False                         # the sun is the lamp's; the sky gives only its light
    nt.links.new(sky.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = SKY
    sc.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy, sun.data.angle, sun.data.color = 3.2, math.radians(0.53), warm
    e, a = math.radians(SUN["altitude"]), math.radians(SUN["azimuth"])
    to_sun = Vector((math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sun)


def inside(poly, X, Y):
    """Which points lie inside a closed polygon (even-odd rule)."""
    res = np.zeros(np.shape(X), dtype=bool)
    for k in range(len(poly)):
        (x0, y0), (x1, y1) = poly[k - 1], poly[k]
        cross = ((y0 > Y) != (y1 > Y)) & (X < x0 + (Y - y0) * (x1 - x0) / (y1 - y0 + 1e-12))
        res ^= cross
    return res


def enclosure_9500(sc, dense, scan_objects, d, hdr, z, cs, filled=False):
    """Enclosure D about 9500 BCE in place of the scan: built from the plan (render/gobekli_built.py) where the
    registration puts it, its floor at the scan's floor there (the lowest tenth of the scan within 3 m of D's middle),
    and the hill round it raised to the wall's top and eased back onto the heightfield over 40 m: the enclosure sunk
    into the slope, as the excavators think the Layer III rings were. How the ground stood round it is a look choice."""
    sys.path.insert(0, HERE)
    import gobekli_built as G
    from giza import enclosure_d as E
    dx, dy = d
    near = dense[np.hypot(dense[:, 0] - dx, dense[:, 1] - dy) < 3.0]
    fd = float(np.percentile(near[:, 2], 10))
    for o in scan_objects:
        bpy.data.objects.remove(o, do_unlink=True)
    coll = bpy.data.collections.new("Enclosure D about 9500 BCE (stand-in)")
    sc.collection.children.link(coll)
    mats = G.materials()
    ring = [p for p in G.pillars() if not p["name"].startswith("central")]
    centre = np.array([np.mean([p["x"] for p in ring]), np.mean([p["y"] for p in ring])])
    made = G.build(coll, mats, centre)
    w = G.walls_and_floor(coll, mats)
    if filled:
        # about 8000 BCE: filled in, nearly to the wall's top, the pillars' heads still showing. A level fill is
        # Schmidt's deliberate backfill; Clare's slope slides would tilt it (render/giza/enclosure_d.py fill_mesh)
        vs, fs = E.fill_mesh(w, w["height"] - FILL_BELOW_TOP, "level")
        me = bpy.data.meshes.new("Enclosure D's fill, about 8000 BCE")
        me.from_pydata(vs, [], fs)
        me.materials.append(soil())
        coll.objects.link(bpy.data.objects.new(me.name, me))
    root = bpy.data.objects.new("Enclosure D (plan frame)", None)
    sc.collection.objects.link(root)
    root.location = (dx, dy, fd)
    for o in coll.objects:
        o.parent = root
    # the tell's later debris taken off: the hill round D lowered to the wall's top within TELL[0] metres, eased back
    # to the present surface by TELL[1] (the mound is about 300 m across; how high the ground stood is a look choice)
    gx = hdr["x0"] + hdr["spacing"] * np.arange(hdr["nx"])
    gy = hdr["y0"] + hdr["spacing"] * np.arange(hdr["ny"])
    GX, GY = np.meshgrid(gx - dx, gy - dy)
    R = np.hypot(GX, GY)
    excess = float(np.median(z[(R > 20) & (R < 40)])) - (fd + w["height"])
    if excess > 0:
        f = np.clip((TELL[1] - R) / (TELL[1] - TELL[0]), 0.0, 1.0)
        z -= (excess * f * f * (3 - 2 * f)).astype(z.dtype)
    half = NEAR[0]
    n = int(round(2 * half / CELL)) + 1
    X, Y = np.meshgrid(cs[0] - half + CELL * np.arange(n), cs[1] - half + CELL * np.arange(n))
    # one cell in from the wall's outer face, so the ground's step down to the floor falls inside the wall's body
    have = inside(np.array(w["outer"]) + (dx, dy), X, Y)
    have &= np.logical_and.reduce([shift(have, dj, di) for dj, di in EIGHT])
    land = terrain_mesh(hdr, z, lambda Z: glue(Z, np.full(Z.shape, fd), np.full(Z.shape, fd + w["height"]), have, 40.0),
                        sc.collection, cs, have)
    return dict(floor=fd, wall_height=w["height"], tell_removed_m=max(0.0, excess), pillars=made,
                centre=[float(v) for v in centre], stand_in=True,
                fill_level=(w["height"] - FILL_BELOW_TOP) if filled else 0.0, land=land,
                note="Enclosure D from its plan (Haklay & Gopher 2020); carving and ground are look choices")


def main():
    a = args()
    out = os.path.abspath(a.get("--out", os.path.join(REPO, "build", "gobekli", "render")))
    os.makedirs(out, exist_ok=True)
    w, h = (int(v) for v in a.get("--size", "1600x900").split("x"))
    fit = json.load(open(os.path.join(MODEL, "fit.json"), encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    root, meshes = place_scan(fit)
    pts = footprint(meshes)
    hdr, z = heightfield()
    # the scan's rim: its outermost points, set on the heightfield (median over the rim)
    c = pts[:, :2].mean(axis=0)
    r = np.hypot(pts[:, 0] - c[0], pts[:, 1] - c[1])
    rim = pts[r > np.percentile(r, 92)]
    dz = float(np.median(sample(hdr, z, rim[:, 0], rim[:, 1]) - rim[:, 2]))
    root.location.z += dz
    bpy.context.view_layer.update()
    pts[:, 2] += dz
    # The heightfield (30 m, a surface model that carries the old spoil heaps) leans about 8 degrees against the scan's
    # rim, while the scan's pillars stand plumb; the scan is trusted. The rim's plane of misfit is added to the
    # heightfield round the excavation, faded out between FIT_R metres from it (look choice).
    rim[:, 2] += dz
    A = np.c_[rim[:, 0] - c[0], rim[:, 1] - c[1], np.ones(len(rim))]
    tilt, *_ = np.linalg.lstsq(A, rim[:, 2] - sample(hdr, z, rim[:, 0], rim[:, 1]), rcond=None)
    gx = hdr["x0"] + hdr["spacing"] * np.arange(hdr["nx"])
    gy = hdr["y0"] + hdr["spacing"] * np.arange(hdr["ny"])
    GX, GY = np.meshgrid(gx - c[0], gy - c[1])
    f = np.clip((FIT_R[1] - np.hypot(GX, GY)) / (FIT_R[1] - FIT_R[0]), 0.0, 1.0)
    z = z + (f * f * (3 - 2 * f) * (tilt[0] * GX + tilt[1] * GY + tilt[2])).astype(z.dtype)
    floor = float(np.percentile(pts[:, 2], 5))
    # the near ground set under the scan and eased onto its rim, from a denser sample of its vertices
    dense = footprint(meshes, 400000)             # read after the lift, so already on the rim
    cs = np.round(c / hdr["spacing"]) * hdr["spacing"]     # the near grid on the 10 m grid's lines
    dx, dy = fit["enclosure_d_in_site"]
    era = a.get("--era", "today")
    ERA[0] = era
    built = {}
    if era == "today":
        lo, hi, have = scan_raster(dense, cs)
        land = terrain_mesh(hdr, z, lambda Z: glue(Z, lo, hi, have), sc.collection, cs, have)
    else:
        built = enclosure_9500(sc, dense, meshes + [root], (dx, dy), hdr, z, cs, filled=(era == "8000"))
        land = built.pop("land")
    # the stones and the trees on the hill (render/gobekli_land.py)
    import gobekli_land as LAND
    surface, outcrop, covered = land
    rng = np.random.default_rng(1)
    LAND.rocks(surface, outcrop, covered, sc.collection, cs, rng)
    LAND.shrubs(surface, outcrop, covered, sc.collection, cs, rng, era)
    LAND.trees(surface, "today" if era == "today" else "9500", covered, sc.collection, cs, rng,
               float(surface(np.array([dx]), np.array([dy]))[0]))
    if era != "today":
        LAND.grass(surface, covered, sc.collection, (dx, dy), rng)
    if a.get("--roof", "off") == "on":
        sys.path.insert(0, os.path.join(REPO, "scripts"))
        from gobekli_register import outline
        mats = (membrane("membrane", (0.74, 0.73, 0.70, 1.0), (0.55, 0.55, 0.53, 1.0), 0.15),
                membrane("membrane underside", (0.80, 0.74, 0.62, 1.0), (0.25, 0.23, 0.21, 1.0), 0.45),
                principled("steel", (0.035, 0.04, 0.05, 1.0), 0.4, metal=0.7),
                principled("walkway deck", (0.30, 0.29, 0.27, 1.0), 0.7, metal=0.3))
        for way, name in SHELTERS.items():
            built[name] = shelter(name, outline(way), hdr, z, sc.collection, mats)
    world_and_sun(sc, *((SUN_9500, (1.0, 0.86, 0.68)) if era != "today" else (SUN, (1.0, 0.9, 0.78))))
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
    sc.view_settings.exposure = float(a.get("--exposure", EXPOSURE))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.clip_end = 2 * SKIRT
    dground = float(sample(hdr, z, dx, dy))
    sx, sy = fit["shelter_centre_in_site"]
    views = {
        # standing on the rim south of Enclosure D, looking north into it
        "rim": (Vector((dx + 3.0, dy - 16.0, floor + 10.0)), Vector((dx, dy, floor + 1.5)), 20),
        # from the same rim, a little closer in: the scan's own central pair and ring, braced as they stand today (a
        # longer lens than this goes past what the scan resolves)
        "pair": (Vector((dx + 3.0, dy - 15.0, floor + 9.5)), Vector((dx, dy + 2.0, floor + 3.2)), 27),
        # from the air, south-west, the whole excavation filling the frame: at 35 mm the plain round it took half the
        # picture and its ground does not hold up that close, so the excavation alone fills it (Stewart, 26 October)
        "air": (Vector((dx - 40.0, dy - 50.0, dground + 48.0)), Vector((c[0] + 9.0, c[1] + 9.0, floor)), 95),
        # the hill from the plain to the south-west, the excavation on its slope
        "hill": (Vector((dx - 420.0, dy - 520.0, dground - 10.0)), Vector((dx, dy, dground)), 85),
        # the main shelter from the ground to its south-west, as the visitor first sees it
        "shelter": (Vector((sx - 48.0, sy - 46.0, float(sample(hdr, z, sx - 48.0, sy - 46.0)) + 1.7)),
                    Vector((sx, sy, dground + 4.0)), 24),
    }
    if era != "today":
        fd = built["floor"] + built.get("fill_level", 0.0)     # the eye stands on the fill once there is one
        p43 = built["pillars"]["43"]
        n43 = np.array(p43["face"])                                              # its carved face's normal
        # radial, its face looks along the wall: stand off the face and in towards the ring's middle, or the eye is
        # in the wall
        in43 = np.array(built["centre"]) - (p43["x"], p43["y"])
        in43 /= np.linalg.norm(in43)
        e43 = np.array((p43["x"], p43["y"])) + 3.6 * n43 + 1.4 * in43
        views.pop("shelter")
        views.update({
            # on the floor south of the central pair, at eye height, looking north between them
            "inside": (Vector((dx, dy - 5.2, fd + 1.6)), Vector((dx, dy, fd + 2.6)), 24),
            # Pillar 43, the Vulture Stone, from in front of its carved face
            "p43": (Vector((dx + e43[0], dy + e43[1], fd + 1.7)),
                    Vector((dx + p43["x"], dy + p43["y"], fd + 1.9)), 32),
        })
        # Pillar 20's carved narrow end, from in the ring in front of it
        p20 = built["pillars"]["20"]
        in20 = np.array(built["centre"]) - (p20["x"], p20["y"])
        in20 /= np.linalg.norm(in20)
        e20 = np.array((p20["x"], p20["y"])) + 3.4 * in20
        views["p20"] = (Vector((dx + e20[0], dy + e20[1], fd + 1.5)), Vector((dx + p20["x"], dy + p20["y"], fd + 1.7)), 30)
        p33 = built["pillars"]["33"]
        n33 = p33["face"]
        views["p33"] = (Vector((dx + p33["x"] + 4.6 * n33[0], dy + p33["y"] + 4.6 * n33[1], fd + 1.7)),
                        Vector((dx + p33["x"], dy + p33["y"], fd + 1.9)), 32)
    which = list(views) if a.get("--view", "all") == "all" else a["--view"].split(",")
    for name in which:
        pos, tgt, lens = views[name]
        cam.location = pos
        cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens
        sc.render.filepath = os.path.join(out, f"gobekli-{era}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", sc.render.filepath, flush=True)
    json.dump({"fit": fit, "era": era, "rim_dz": dz, "sun": SUN, "built": built, "views": {k: [list(v[0]), list(v[1]), v[2]] for k, v in views.items()},
               "stand_in": True, "note": "the scan is a visual stand-in (rmark, CC BY 4.0); placement and look are choices"},
              open(os.path.join(out, f"gobekli-{era}.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
