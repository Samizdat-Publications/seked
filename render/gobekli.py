"""
Göbekli Tepe today: the photogrammetry scan of the main excavation on its hill.

    blender -b --factory-startup -P render/gobekli.py -- [--view rim|air|hill|all] [--size 1600x900] [--samples 64]
        [--out DIR]

The scan (blender/models.json `gobekli-site-rmark`, rmark, CC BY 4.0) is placed by scripts/gobekli_register.py's
fit (build/models/gobekli-site-rmark/fit.json): scaled and turned onto Enclosure D's plan by its 13 pillars (rms
about 0.5 m, the plan's own sigma), set in the site frame under OpenStreetMap's outline of the main shelter, its
rim on the GLO-30 heightfield (data/terrain/gobekli-glo30), which is drawn out to 1.5 km in every direction. The
heightfield is cut away under the scan, so the excavation is the scan's own. The modern shelter roof is not drawn
yet, and the sun, the sky and the ground's colour are look choices. A visual stand-in: nothing of the scan's form is
a measurement. Frame: metres, +x east, +y north, +z up, origin at the UNESCO point (data/sites.json gobekli-tepe).
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
MODEL = os.path.join(REPO, "build", "models", "gobekli-site-rmark")
TERRAIN = os.path.join(REPO, "data", "terrain", "gobekli-glo30")
SUN = {"altitude": 32.0, "azimuth": 235.0}      # a late October afternoon (look choice)
SKY = 0.12                                      # the physical sky's strength beside the sun lamp (look choice)
EXPOSURE = -0.5
GROUND = (0.20, 0.135, 0.085, 1.0)             # the Harran plain's dry red-brown soil after the harvest (look choice)
SINK_PAD = 2.0                                  # m inside the scan's footprint, the heightfield sinks under the scan
SINK = 3.0                                      # m it sinks below the scan's floor there
SINK_EASE = 6.0                                 # m over which it eases down from the outline
NEAR = (160.0, 2.0)                             # half-width and spacing of the finer ground round the excavation


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


def footprint(meshes):
    """The scan's vertices in the site frame, thinned: for the rim, the cut and the camera."""
    pts = []
    for o in meshes:
        n = len(o.data.vertices)
        co = np.empty(n * 3)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)[:: max(1, n // 4000)]
        mw = np.array(o.matrix_world)
        pts.append(co @ mw[:3, :3].T + mw[:3, 3])
    return np.concatenate(pts)


def convex_hull(p):
    """Counter-clockwise convex hull of 2D points (Andrew's monotone chain)."""
    p = p[np.lexsort((p[:, 1], p[:, 0]))]
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for q in p:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    for q in p[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    return np.array(lower[:-1] + upper[:-1])


def depth_inside(hull, X, Y, pad=0.0):
    """How far each point lies inside the convex hull, less `pad` metres (negative outside)."""
    d = np.full(np.shape(X), np.inf)
    for k in range(len(hull)):
        a, b = hull[k], hull[(k + 1) % len(hull)]
        ex, ey = b - a
        L = math.hypot(ex, ey)
        d = np.minimum(d, (ex * (Y - a[1]) - ey * (X - a[0])) / L)
    return d - pad


def terrain_mesh(hdr, z, sink, coll, centre, floor):
    """The hill as two grids: the heightfield's own 10 m out to 1.5 km with a square hole round the excavation, and a
    2 m grid resampled from it inside that square, sunk under the scan where `sink` says so."""
    half, step = NEAR
    def grid(x0, x1, y0, y1, sp):
        xs = np.arange(x0, x1 + 1e-6, sp)
        ys = np.arange(y0, y1 + 1e-6, sp)
        X, Y = np.meshgrid(xs, ys)
        return X, Y
    meshes = []
    nx, ny, sp = hdr["nx"], hdr["ny"], hdr["spacing"]
    X, Y = grid(hdr["x0"], hdr["x0"] + (nx - 1) * sp, hdr["y0"], hdr["y0"] + (ny - 1) * sp, sp)
    far_hole = lambda x, y: (abs(x - centre[0]) < half - sp) & (abs(y - centre[1]) < half - sp)
    meshes.append((X, Y, z.copy(), far_hole))
    X2, Y2 = grid(centre[0] - half, centre[0] + half, centre[1] - half, centre[1] + half, step)
    Z2 = sample(hdr, z, X2, Y2)
    # eased down over SINK_EASE metres inside the scan's outline, so no cliff stands round it
    w = np.clip(sink(X2, Y2) / SINK_EASE, 0.0, 1.0)
    w = w * w * (3 - 2 * w)
    Z2 = Z2 - w * np.maximum(Z2 - (floor - SINK), 0.0)
    meshes.append((X2, Y2, Z2, None))
    m = soil()
    for k, (X, Y, Z, hole) in enumerate(meshes):
        ny_, nx_ = X.shape
        verts = np.c_[X.ravel(), Y.ravel(), Z.ravel()]
        drop = hole(X.ravel(), Y.ravel()) if hole else np.zeros(X.size, dtype=bool)
        faces = []
        for j in range(ny_ - 1):
            for i in range(nx_ - 1):
                a = j * nx_ + i
                quad = (a, a + 1, a + nx_ + 1, a + nx_)
                if not all(drop[q] for q in quad):
                    faces.append(quad)
        me = bpy.data.meshes.new(f"hill (GLO-30) {k}")
        me.from_pydata(verts.tolist(), [], faces)
        me.shade_smooth()
        me.materials.append(m)
        ob = bpy.data.objects.new(me.name, me)
        coll.objects.link(ob)


def soil():
    """The hill's dry stony soil: the plateau's own CC0 scan of dry ground strewn with limestone chips (Poly Haven,
    blender/textures.json role `gravel`), box-projected at its size and tinted towards the Harran soil, with its
    relief as a bump, and a slow mottle so the hill is not one colour (look choices)."""
    sys.path.insert(0, HERE)
    from giza.materials import TEX, image
    m = bpy.data.materials.new("Harran soil")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.95
    co = N.new("ShaderNodeTexCoord").outputs["Object"]
    mp = N.new("ShaderNodeMapping")
    t = TEX["gravel"]["tile_m"][0]
    mp.inputs["Scale"].default_value = (1 / t, 1 / t, 1 / t)
    L.new(co, mp.inputs["Vector"])
    di = N.new("ShaderNodeTexImage"); di.image, di.projection, di.projection_blend = image("gravel", "Diffuse"), "BOX", 0.3
    hm = N.new("ShaderNodeTexImage"); hm.image, hm.projection, hm.projection_blend = image("gravel", "Displacement", True), "BOX", 0.3
    L.new(mp.outputs[0], di.inputs["Vector"]); L.new(mp.outputs[0], hm.inputs["Vector"])
    # the same scan again at 2.7 times the size and turned, mixed in under a slow noise, so its tile does not repeat
    mp2 = N.new("ShaderNodeMapping")
    mp2.inputs["Scale"].default_value = (1 / (2.7 * t), 1 / (2.7 * t), 1 / (2.7 * t))
    mp2.inputs["Rotation"].default_value = (0.0, 0.0, 0.7)
    L.new(co, mp2.inputs["Vector"])
    di2 = N.new("ShaderNodeTexImage"); di2.image, di2.projection, di2.projection_blend = image("gravel", "Diffuse"), "BOX", 0.3
    L.new(mp2.outputs[0], di2.inputs["Vector"])
    patch = N.new("ShaderNodeTexNoise"); patch.inputs["Scale"].default_value = 0.08; patch.inputs["Detail"].default_value = 4.0
    L.new(co, patch.inputs["Vector"])
    both = N.new("ShaderNodeMix"); both.data_type = "RGBA"
    L.new(patch.outputs["Fac"], both.inputs[0]); L.new(di.outputs["Color"], both.inputs[6]); L.new(di2.outputs["Color"], both.inputs[7])
    tint = N.new("ShaderNodeMix"); tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs[0].default_value = 1.0
    tint.inputs[7].default_value = (GROUND[0] * 3.2, GROUND[1] * 3.2, GROUND[2] * 3.2, 1.0)
    L.new(both.outputs[2], tint.inputs[6])
    mott = N.new("ShaderNodeTexNoise"); mott.inputs["Scale"].default_value = 0.02; mott.inputs["Detail"].default_value = 3.0
    L.new(co, mott.inputs["Vector"])
    ramp = N.new("ShaderNodeMapRange"); ramp.inputs[1].default_value, ramp.inputs[2].default_value = 0.35, 0.65
    ramp.inputs[3].default_value, ramp.inputs[4].default_value = 0.8, 1.15
    L.new(mott.outputs["Fac"], ramp.inputs[0])
    shade = N.new("ShaderNodeMix"); shade.data_type, shade.blend_type = "RGBA", "MULTIPLY"
    shade.inputs[0].default_value = 1.0
    L.new(tint.outputs[2], shade.inputs[6])
    comb = N.new("ShaderNodeCombineColor")
    for k in range(3):
        L.new(ramp.outputs[0], comb.inputs[k])
    L.new(comb.outputs[0], shade.inputs[7])
    L.new(shade.outputs[2], b.inputs["Base Color"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.inputs["Distance"].default_value = 0.05
    L.new(hm.outputs["Color"], bump.inputs["Height"]); L.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def world_and_sun(sc):
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
    sun.data.energy, sun.data.angle = 3.2, math.radians(0.53)
    e, a = math.radians(SUN["altitude"]), math.radians(SUN["azimuth"])
    to_sun = Vector((math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sun)


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
    # sink the heightfield under the scan's footprint: its convex outline, drawn in by SINK_PAD
    hull = convex_hull(pts[:, :2])
    floor = float(np.percentile(pts[:, 2], 5))
    terrain_mesh(hdr, z, lambda X, Y: depth_inside(hull, X, Y, SINK_PAD), sc.collection, c, floor)
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
    sc.view_settings.exposure = float(a.get("--exposure", EXPOSURE))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.clip_end = 6000
    dx, dy = fit["enclosure_d_in_site"]
    dground = float(sample(hdr, z, dx, dy))
    views = {
        # standing on the rim south of Enclosure D, looking north into it
        "rim": (Vector((dx + 3.0, dy - 16.0, floor + 10.0)), Vector((dx, dy, floor + 1.5)), 20),
        # from the air, south-west, the whole excavation
        "air": (Vector((dx - 45.0, dy - 55.0, dground + 45.0)), Vector((c[0], c[1], floor)), 35),
        # the hill from the plain to the south-west, the excavation on its slope
        "hill": (Vector((dx - 420.0, dy - 520.0, dground - 10.0)), Vector((dx, dy, dground)), 85),
    }
    which = list(views) if a.get("--view", "all") == "all" else [a["--view"]]
    for name in which:
        pos, tgt, lens = views[name]
        cam.location = pos
        cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens
        sc.render.filepath = os.path.join(out, f"gobekli-today-{name}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", sc.render.filepath, flush=True)
    json.dump({"fit": fit, "rim_dz": dz, "sun": SUN, "views": {k: [list(v[0]), list(v[1]), v[2]] for k, v in views.items()},
               "stand_in": True, "note": "the scan is a visual stand-in (rmark, CC BY 4.0); placement and look are choices"},
              open(os.path.join(out, "gobekli-today.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
