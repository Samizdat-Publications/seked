"""
Register the Göbekli Tepe photogrammetry scan (blender/models.json `gobekli-site-rmark`) to Enclosure D's plan.

    python scripts/gobekli_register.py            # writes build/models/gobekli-site-rmark/fit.json

The scan has no scale or orientation of its own. Its pillar tops are found and fitted to the 13 pillar positions in
data/measurements/gobekli.json (Haklay and Gopher 2020, Fig. 1, scaled from the plate, sigma about 0.5 m):

1. Blender renders the scan from straight above, orthographic, as a height map (scan z as emission), to an EXR.
2. Heights more than 6 scan units above the local median (a 61-pixel window) are protrusions; each connected
   protrusion of 40 pixels or more is a candidate pillar top, its centroid in scan (x, y).
3. The two cable-braced central pillars (the largest protrusions near the given pixels, picked by eye once from the
   render and kept here) fix a first similarity transform onto the plan's central pair; iterative closest point
   over all 13 plan pillars, each taking its nearest candidate within 2 m, refines scale, rotation and offset.

The fit is a complex similarity z' = m z + t from scan (x, y) to Enclosure D's plan (east, north) in metres; its
residual is written beside it. Then the scan is set on the ground: its footprint is centred on OpenStreetMap's
outline of the main excavation shelter (way 502057666), which stands over enclosures A to D, and its rim on the
GLO-30 heightfield (data/terrain/gobekli-glo30). Both are look choices good to a few metres, and said so.
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "build", "models", "gobekli-site-rmark")
WORK = os.path.join(ROOT, "build", "gobekli", "register")
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
BRACED_PX = [(1663, 581), (1663, 806)]   # the two cable-braced central pillars in the 2048-wide height map
SHELTER_WAY = 502057666                  # OSM: the main shelter, "Göbeklitepe Archaeological Site"

HEIGHTMAP = r'''
import bpy, json, numpy as np
from mathutils import Vector
SRC, OUT = {src!r}, {out!r}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (lo + hi) / 2
m = bpy.data.materials.new("h"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission"); g = nt.nodes.new("ShaderNodeNewGeometry")
sx = nt.nodes.new("ShaderNodeSeparateXYZ"); mr = nt.nodes.new("ShaderNodeMapRange")
mr.inputs["From Min"].default_value = lo.z; mr.inputs["From Max"].default_value = hi.z
nt.links.new(g.outputs["Position"], sx.inputs[0]); nt.links.new(sx.outputs["Z"], mr.inputs["Value"])
nt.links.new(mr.outputs[0], e.inputs["Strength"]); nt.links.new(e.outputs[0], o.inputs["Surface"])
bpy.context.view_layer.material_override = m
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 4; sc.cycles.use_denoising = False
W, H = hi.x - lo.x, hi.y - lo.y
sc.render.resolution_x = 2048; sc.render.resolution_y = int(2048 * H / W)
sc.view_settings.view_transform = "Standard"
sc.render.image_settings.file_format = "OPEN_EXR"; sc.render.image_settings.color_depth = "32"
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = max(W, H); cam.location = (c.x, c.y, hi.z + 10); cam.data.clip_end = 1000
sc.render.filepath = OUT + "/height.exr"; bpy.ops.render.render(write_still=True)
img = bpy.data.images.load(OUT + "/height.exr"); w, h = img.size
a = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(a)
np.save(OUT + "/height.npy", a.reshape(h, w, 4)[:, :, 0][::-1])
json.dump({{"lo": list(lo), "hi": list(hi), "px": [w, h], "ortho": max(W, H)}}, open(OUT + "/height.json", "w"))
'''


def plan():
    recs = json.load(open(os.path.join(ROOT, "data", "measurements", "gobekli.json"), encoding="utf-8"))
    recs = recs["records"] if isinstance(recs, dict) else recs
    P = {}
    for r in recs:
        k = r["key"]
        for f in ("east", "north"):
            if k.startswith("gobekli.enclosure_d.pillar.") and k.endswith("." + f):
                P.setdefault(k.split(".")[3], {})[f] = r["value"]
    names = sorted(P)
    return names, np.array([P[k]["east"] + 1j * P[k]["north"] for k in names])


def candidates():
    from scipy import ndimage as nd
    z01 = np.load(os.path.join(WORK, "height.npy"))
    meta = json.load(open(os.path.join(WORK, "height.json")))
    lo, hi = meta["lo"], meta["hi"]
    W, H = meta["px"]
    upx = meta["ortho"] / max(W, H)
    z = lo[2] + z01 * (hi[2] - lo[2])
    z[z01 <= 0] = np.nan
    zz = np.nan_to_num(z, nan=np.nanmin(z))
    prot = zz - nd.median_filter(zz, size=61)
    mask = prot > 6.0
    lab, n = nd.label(mask)
    idx = range(1, n + 1)
    cx0, cy0 = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
    out, px = [], []
    for s, (r, c) in zip(nd.sum(mask, lab, idx), nd.center_of_mass(mask, lab, idx)):
        if s >= 40:
            out.append((cx0 + (c - W / 2) * upx) + 1j * (cy0 + (H / 2 - r) * upx))
            px.append((c, r))
    return np.array(out), np.array(px), meta


def fit(Z, PX, names, B):
    near = lambda p: int(np.argmin(np.hypot(PX[:, 0] - p[0], PX[:, 1] - p[1])))
    a, b = near(BRACED_PX[0]), near(BRACED_PX[1])
    cw, ce = B[names.index("central_west")], B[names.index("central_east")]
    best = None
    for i, j in ((a, b), (b, a)):
        m = (ce - cw) / (Z[j] - Z[i]); t = cw - m * Z[i]
        for _ in range(30):
            T = m * Z + t
            src, dst = [], []
            for bp in B:
                d = abs(T - bp); q = int(np.argmin(d))
                if d[q] < 2.0:
                    src.append(Z[q]); dst.append(bp)
            A, D = np.array(src), np.array(dst)
            m = np.sum((D - D.mean()) * np.conj(A - A.mean())) / np.sum(abs(A - A.mean()) ** 2)
            t = D.mean() - m * A.mean()
        res = abs(m * A + t - D)
        cand = (len(A), -float(np.sqrt((res ** 2).mean())), m, t, res)
        if best is None or cand[:2] > best[:2]:
            best = cand
    n, neg_rms, m, t, res = best
    return m, t, n, -neg_rms, float(res.max())


def shelter_centre():
    """The main shelter's centre in the site frame (east, north of the UNESCO origin), from OpenStreetMap."""
    import requests
    sites = json.load(open(os.path.join(ROOT, "data", "sites.json"), encoding="utf-8"))
    sites = sites["sites"] if isinstance(sites, dict) else sites
    o = next(s for s in sites if s["id"] == "gobekli-tepe")["origin"]
    cache = os.path.join(ROOT, "build", "gobekli", "osm-around.json")   # an Overpass answer kept from an earlier run
    els = json.load(open(cache, encoding="utf-8"))["elements"] if os.path.exists(cache) else []
    g = next((e["geometry"] for e in els if e.get("id") == SHELTER_WAY), None)
    if g is None:
        q = f"[out:json][timeout:60];way({SHELTER_WAY});out geom;"
        g = requests.post("https://overpass-api.de/api/interpreter", data={"data": q},
                          headers={"User-Agent": "seked"}, timeout=120).json()["elements"][0]["geometry"]
    # the heightfield's own local tangent plane (data/terrain/gobekli-glo30.json `projection`), from WGS84's a and 1/f
    const = json.load(open(os.path.join(ROOT, "data", "measurements", "units-and-constants.json"), encoding="utf-8"))
    const = {r["key"]: r["value"] for r in (const["records"] if isinstance(const, dict) else const) if "key" in r}
    a, f = const["earth.radius.equatorial"], 1 / const["earth.inverse_flattening"]
    e2, lat = f * (2 - f), np.radians(o["latitude"])
    w = 1 - e2 * np.sin(lat) ** 2
    mn = np.radians(1) * a * (1 - e2) / w ** 1.5
    me = np.radians(1) * np.cos(lat) * a / np.sqrt(w)
    xs = [(p["lon"] - o["longitude"]) * me for p in g]
    ys = [(p["lat"] - o["latitude"]) * mn for p in g]
    return float(np.mean(xs)), float(np.mean(ys))


def main():
    os.makedirs(WORK, exist_ok=True)
    src = os.path.join(MODEL, "model-1k.glb")
    if not os.path.exists(os.path.join(WORK, "height.npy")):
        script = os.path.join(WORK, "heightmap.py")
        open(script, "w", encoding="utf-8").write(HEIGHTMAP.format(src=src, out=WORK))
        subprocess.run([BLENDER, "-b", "--factory-startup", "-P", script], check=True, capture_output=True)
    Z, PX, meta = candidates()
    names, B = plan()
    m, t, n, rms, mx = fit(Z, PX, names, B)
    lo, hi = meta["lo"], meta["hi"]
    centre_scan = complex((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2)
    centre_plan = m * centre_scan + t          # the scan's footprint centre, in Enclosure D's plan frame
    se, sn = shelter_centre()
    out = {"scale_m_per_unit": abs(m), "rotation_deg": float(np.degrees(np.angle(m))),
           "t_east": t.real, "t_north": t.imag, "pairs": n, "rms_m": rms, "max_m": mx,
           "scan_centre_in_plan": [centre_plan.real, centre_plan.imag],
           "shelter_centre_in_site": [se, sn],
           "enclosure_d_in_site": [se - centre_plan.real, sn - centre_plan.imag],
           "source": "data/measurements/gobekli.json (Haklay and Gopher 2020 Fig. 1, scaled); OSM way 502057666",
           "note": ("scan (x, y) -> Enclosure D plan (east, north) in metres: z' = m z + t, m = scale * e^(i rotation). "
                    "Enclosure D's centre stands in the site frame where the scan's footprint, centred on the OSM "
                    "shelter outline, puts it: a look choice good to a few metres.")}
    json.dump(out, open(os.path.join(MODEL, "fit.json"), "w"), indent=1)
    print(f"{n} pillars, rms {rms:.2f} m (max {mx:.2f}); scale {abs(m):.4f} m/unit, rotation "
          f"{out['rotation_deg']:.1f} deg; Enclosure D at E{out['enclosure_d_in_site'][0]:.1f} "
          f"N{out['enclosure_d_in_site'][1]:.1f} of the origin")


if __name__ == "__main__":
    sys.exit(main())
