"""
Build the plateau in Blender and render views of it.

    blender -b --factory-startup -P render/build.py -- --state today --station south
    blender -b --factory-startup -P render/build.py -- --state built --shot panorama --size 1920x1080 --samples 128
    blender -b --factory-startup -P render/build.py -- --queue render/queues/spike.json
    blender -b --factory-startup -P render/build.py -- --film approach-built      # render/films.json
    blender -b --factory-startup -P render/build.py -- --films render/films-exhibit.json --film ch0-sunrise--ch0-behind

A queue is {"renders": [{"state", "station" | "shot", "moment"?, "size"?, "samples"?, "out"?, "patch"?}, ...]};
a "patch" ({yaw, pitch, fov, aspect}) renders a station through a lens instead of whole (render/patches.py);
"transparent": true leaves the sky out (alpha, and the star dome hidden), for a page that draws its own sky;
"exposure" sets the view's exposure for that render only (a roofed hall's 2.4 blows out the same hall unroofed);
each state is built once and every view in it rendered from the same scene.
Outputs default to build/render/<view>-<state>.png.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import cameras, data  # noqa: E402
from giza.scene import Plateau  # noqa: E402

DEFAULTS = {"station": {"size": "4096x2048", "samples": 96}, "shot": {"size": "1920x1080", "samples": 128}}


def parse(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    o = {}
    it = iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it)
    return o


def renders_from(opts):
    if "queue" in opts:
        with open(opts["queue"], encoding="utf-8") as f:
            return json.load(f)["renders"]
    r = {"state": opts.get("state", "today")}
    for k in ("station", "shot", "moment", "size", "samples", "out"):
        if k in opts:
            r[k] = opts[k]
    return [r]


def _film_spec(film_id, opts):
    """A film's spec from render/films.json, or from the films file --films names (render/films-exhibit.json)."""
    import io
    path = opts.get("films") or os.path.join(HERE, "films.json")
    with io.open(path, encoding="utf-8") as f:
        return next(x for x in json.load(f)["films"] if x["id"] == film_id)


def _lens(lens, t):
    """A flight's focal length at t: one number, or one per control point, eased between them in log space."""
    if not isinstance(lens, list):
        return lens
    n = len(lens) - 1
    s = min(max(t, 0.0), 1.0) * n
    i = min(int(s), n - 1)
    f = s - i
    f = f * f * (3 - 2 * f)
    return math.exp(math.log(lens[i]) * (1 - f) + math.log(lens[i + 1]) * f)


def _catmull(points, t):
    """A point on the uniform Catmull-Rom curve through `points` at t in [0, 1], ends clamped."""
    n = len(points) - 1
    s = min(max(t, 0.0), 1.0) * n
    i = min(int(s), n - 1)
    u = s - i
    p = [points[max(0, min(n, i + k))] for k in (-1, 0, 1, 2)]
    return tuple(0.5 * (2 * p[1][d] + (-p[0][d] + p[2][d]) * u + (2 * p[0][d] - 5 * p[1][d] + 4 * p[2][d] - p[3][d]) * u * u
                        + (-p[0][d] + 3 * p[1][d] - 3 * p[2][d] + p[3][d]) * u ** 3) for d in range(3))


def film(film_id, opts):
    """Render a flight's frames from one built era (render/films.json); skips frames already on disk."""
    import io
    from giza import cameras
    spec = _film_spec(film_id, opts)
    stations, _ = data.views()
    plateau = Plateau(spec["state"], aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)))
    cx, cy = spec["centre"]
    where = {"id": film_id, "x": cx, "y": cy, "eye": 1.7, "target": list(spec["look"][-1]), "lens": _lens(spec["lens"], 0.0)}
    if spec.get("inside"):
        # Inside the pyramid: the era's lamps and the inside exposure, no sun to set.
        where.update(inside=True, z=spec["path"][0][2])
    plateau.view(where, "shot")
    if not spec.get("inside"):
        plateau.moment(stations["moments"][spec["moment"]])
    if spec.get("stars"):
        # A twilight flight with one frame of a sky bake's stars over it (render/films-showcase.json): the sky fixed,
        # the dome round the first eye, the stars put up as sky_film does so a twilight's exposure leaves them seen.
        from giza import night
        st = spec["stars"]
        render_sky = night._render_sky()
        bake = render_sky.load_rollback(os.path.join(data.REPO, st["bake"]))
        if plateau.night is None:
            plateau.night = night.Night(plateau.scene, plateau.scene.world.node_tree, plateau.log)
        k = int(st.get("frame", -1)) % len(bake[0]["frames"])
        plateau.night.show_frame(bake, k, tuple(spec["path"][0]))
        moment = stations["moments"][spec["moment"]]
        gain = float(st.get("gain", 2.0 ** (night.EXPOSURE - moment.get("exposure", night.EXPOSURE))))
        flux = plateau.night.dome.data.attributes[render_sky.STAR_FLUX_ATTRIBUTE].data
        flux.foreach_set("value", [d.value * gain for d in flux])
    if "exposure" in spec:
        plateau.scene.view_settings.exposure = float(spec["exposure"])   # this flight's own exposure (a look choice)
    if spec.get("tile"):
        # a big frame in tiles, denoised on the CPU: at 2560 x 1440 the GPU ran out of memory with the plateau loaded
        plateau.scene.cycles.use_auto_tile = True
        plateau.scene.cycles.tile_size = int(spec["tile"])
        plateau.scene.cycles.denoising_use_gpu = False
    # The camera alone moves, so Cycles keeps the scene between frames instead of rebuilding it for each.
    plateau.scene.render.use_persistent_data = True
    w, h = (int(n) for n in opts.get("size", spec["size"]).split("x"))
    samples = int(opts.get("samples", spec["samples"]))
    n = int(spec["fps"] * spec["seconds"])
    # --preview 0,96,200 renders just those frames into build/films/<id>/preview, to try a path cheaply.
    preview = [int(k) for k in opts["preview"].split(",")] if opts.get("preview") else None
    frames = os.path.join(data.REPO, "build", "films", film_id, "preview" if preview else "frames")
    os.makedirs(frames, exist_ok=True)
    for k in (preview if preview else range(n)):
        out = os.path.join(frames, f"frame_{k:04d}.png")
        if os.path.exists(out) and not preview:
            continue
        t = k / (n - 1)
        t = t * t * (3 - 2 * t)                    # ease in and out
        cameras.frame(plateau.camera, _catmull(spec["path"], t), _catmull(spec["look"], t), _lens(spec["lens"], t))
        plateau.render(out, w, h, samples, view_id=f"{film_id} {k}", kind="film", moment=spec.get("moment"))
    print(f"film {film_id}: {n} frames in {frames}")


def night_film(film_id, opts):
    """
    A night film from the sky-rollback bake: the camera stands at `at`, looking south, and tilts
    to follow the meridian star as the epochs roll back, so the ground comes into view as its
    transit sinks; every star of every frame is where the bake puts it.
    """
    import io
    import math
    from giza import cameras, night
    spec = _film_spec(film_id, opts)
    render_sky = night._render_sky()
    rollback = render_sky.load_rollback(os.path.join(data.REPO, "build", "sky-rollback.json"))
    stations, _ = data.views()
    plateau = Plateau(spec["state"], aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)))
    x, y = spec["at"]
    plateau.view({"id": film_id, "x": x, "y": y, "eye": spec.get("eye", 1.7), "target": [x, y - 100.0, 40.0],
                  "lens": spec["lens"]}, "shot")
    plateau.moment(stations["moments"][spec["moment"]])      # a night: the sun where that night's bake puts it
    plateau.scene.render.use_persistent_data = True
    eye = tuple(plateau.camera.location)
    w, h = (int(n) for n in spec["size"].split("x"))
    frames = os.path.join(data.REPO, "build", "films", film_id, "frames")
    os.makedirs(frames, exist_ok=True)
    n = len(rollback[0]["frames"])
    step = int(spec.get("every", 1))
    log = []
    for k in range(0, n, step):
        out = os.path.join(frames, f"frame_{k // step:04d}.png")
        row = plateau.night.show_frame(rollback, k, eye)
        log.append({"frame": k // step, "epoch": row["epoch"], "meridianAltDeg": row["meridianAltDeg"]})
        if os.path.exists(out):
            continue
        pitch = math.radians(max(spec.get("min_pitch", 12.0), row["meridianAltDeg"] - spec.get("below", 12.0)))
        target = (eye[0], eye[1] - 100.0 * math.cos(pitch), eye[2] + 100.0 * math.sin(pitch))
        cameras.frame(plateau.camera, eye, target, spec["lens"])
        plateau.render(out, w, h, int(spec["samples"]), view_id=f"{film_id} {k}", kind="film", moment=spec["moment"])
    with io.open(os.path.join(data.REPO, "build", "films", film_id, "epochs.json"), "w", encoding="utf-8") as f:
        json.dump(log, f)
    print(f"night film {film_id}: {len(log)} frames in {frames}")


def _figure_lines(scene, figure, eye, look):
    """A constellation's figure as gold lines on the star dome, one two-point spline a segment; None without one."""
    if not figure or not figure.get("segments"):
        return None
    import bpy
    cu = bpy.data.curves.new("figure " + figure["name"], "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = float(look.get("radius_m", 3.0))      # about a pixel and a half wide at the dome's distance
    for _ in figure["segments"]:
        sp = cu.splines.new("POLY")
        sp.points.add(1)
    mat = bpy.data.materials.new("figure gold")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = tuple(look.get("colour", (1.0, 0.74, 0.32))) + (1.0,)
    em.inputs["Strength"].default_value = float(look.get("strength", 0.6))
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    cu.materials.append(mat)
    ob = bpy.data.objects.new("figure " + figure["name"], cu)
    ob.location = eye
    ob.visible_shadow = False
    scene.collection.objects.link(ob)
    return ob, figure["segments"]


def _place_figure(lines, bake, k, radius):
    """Each segment between its two stars at frame k, shortened at both ends; one with a star under 0.5 deg is hidden."""
    import math
    ob, segments = lines
    header, values = bake
    count = header["catalogue"]["count"]
    base = k * count * 2

    def at(i):
        az, alt = math.radians(values[base + 2 * i]), math.radians(values[base + 2 * i + 1])
        return (radius * math.cos(alt) * math.sin(az), radius * math.cos(alt) * math.cos(az), radius * math.sin(alt)), values[base + 2 * i + 1]
    for sp, (i, j) in zip(ob.data.splines, segments):
        (p, ap), (q, aq) = at(i), at(j)
        show = ap > 0.5 and aq > 0.5
        gap = 0.12                                           # a little short of each star, so the dot stays its own
        p2 = tuple(p[c] + (q[c] - p[c]) * gap for c in range(3))
        q2 = tuple(q[c] + (p[c] - q[c]) * gap for c in range(3))
        for pt, co in zip(sp.points, (p2, q2)):
            pt.co = co + (1.0,)
            pt.radius = 1.0 if show else 0.0


def sky_film(film_id, opts):
    """
    A sky film from a frame-by-frame bake (render/films-sky.json names it; scripts/sky-leo.ts writes chapter 2's):
    the station's own scene in its era and moment, the light fixed, every star moved to each frame's baked place,
    the camera easing from `from` to `to` (yaw, pitch, vertical field), so the last frame is the leaf's own view.
    The stars are put up by `star_gain` (by default what the moment's exposure takes off the night's), since a
    twilight's exposure would leave all but the brightest unseen in a film meant to show them.
    """
    import io
    import math
    from giza import cameras, night
    path = opts.get("films") or os.path.join(HERE, "films-sky.json")
    with io.open(path, encoding="utf-8") as f:
        spec = next(x for x in json.load(f)["films"] if x["id"] == film_id)
    render_sky = night._render_sky()
    bake = render_sky.load_rollback(os.path.join(data.REPO, spec["bake"]))
    stations, _ = data.views()
    st = next(s for s in stations["stations"] if s["id"] == spec["station"])
    st = dict(st, **st.get("by_state", {}).get(spec["state"], {}))
    plateau = Plateau(spec["state"], aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)))
    plateau.view(st, "station")
    moment = stations["moments"][spec["moment"]]
    plateau.moment(moment)
    plateau.scene.render.use_persistent_data = True
    if plateau.night is None:
        plateau.night = night.Night(plateau.scene, plateau.scene.world.node_tree, plateau.log)
    eye = tuple(plateau.camera.location)
    gain = float(spec.get("star_gain", 2.0 ** (night.EXPOSURE - moment.get("exposure", night.EXPOSURE))))
    w, h = (int(n) for n in spec["size"].split("x"))
    frames = os.path.join(data.REPO, "build", "films", film_id, "frames")
    os.makedirs(frames, exist_ok=True)
    n = len(bake[0]["frames"])
    only = {int(k) for k in opts["frames"].split(",")} if "frames" in opts else None
    a, b = spec["from"], spec["to"]
    lines = _figure_lines(plateau.scene, bake[0].get("figure"), eye, spec.get("line", {}))
    for k in range(n):
        if only is not None and k not in only:
            continue
        out = os.path.join(frames, f"frame_{k:04d}.png")
        if os.path.exists(out):
            continue
        plateau.night.show_frame(bake, k, eye)
        if gain != 1.0 and not plateau.night.dome.get("seked_gain"):
            flux = plateau.night.dome.data.attributes[render_sky.STAR_FLUX_ATTRIBUTE].data
            vals = [d.value * gain for d in flux]
            flux.foreach_set("value", vals)
            plateau.night.dome["seked_gain"] = gain
        if lines is not None:
            _place_figure(lines, bake, k, render_sky.DOME_RADIUS_M * 0.98)
        t = k / (n - 1)
        e = t * t * (3 - 2 * t)
        cameras.aim(plateau.camera, eye, a["yaw"] + (b["yaw"] - a["yaw"]) * e, a["pitch"] + (b["pitch"] - a["pitch"]) * e,
                    a["fov"] + (b["fov"] - a["fov"]) * e, w / h)
        plateau.render(out, w, h, int(spec["samples"]), view_id=f"{film_id} {k}", kind="film", moment=spec["moment"])
    print(f"sky film {film_id}: {n} frames in {frames}")


def main():
    opts = parse(sys.argv)
    if "sky-film" in opts:
        sky_film(opts["sky-film"], opts)
        return
    if "film" in opts:
        film(opts["film"], opts)
        return
    if "night-film" in opts:
        night_film(opts["night-film"], opts)
        return
    stations, shots = data.views()
    moments = stations["moments"]
    by_id = {("station", s["id"]): s for s in stations["stations"]}
    by_id.update({("shot", s["id"]): s for s in shots["shots"]})
    renders = renders_from(opts)
    states = []
    for r in renders:
        if r["state"] not in states:
            states.append(r["state"])
    for state in states:
        plateau = Plateau(state, aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)),
                          stones=opts.get("stones", "1") == "1")
        for r in (r for r in renders if r["state"] == state):
            kind = "station" if "station" in r else "shot"
            v = by_id[(kind, r[kind])]
            # A view may stand somewhere else in one era (on a boat where the ground is under water).
            v = dict(v, **v.get("by_state", {}).get(state, {}))
            if "exposure" in r:
                v = dict(v, exposure=float(r["exposure"]))
            plateau.view(v, kind)
            if "patch" in r:
                # the station's own scene seen through a lens, for apps/walk to lay over the panorama
                p = r["patch"]
                cameras.aim(plateau.camera, tuple(plateau.camera.location), p["yaw"], p["pitch"], p["fov"], p["aspect"])
            m = r.get("moment", v.get("moment"))
            if m is not None:
                plateau.moment(moments[m] if isinstance(m, str) else m)
            w, h = (int(n) for n in str(r.get("size", DEFAULTS[kind]["size"])).split("x"))
            samples = int(r.get("samples", DEFAULTS[kind]["samples"]))
            out = r.get("out") or os.path.join(data.REPO, "build", "render", f"{r[kind]}-{state}.png")
            plateau.scene.render.film_transparent = bool(r.get("transparent", False))
            if r.get("transparent") and plateau.night is not None and plateau.night.dome is not None:
                plateau.night.dome.hide_render = True   # the stars are a dome of geometry, not the world
            plateau.render(os.path.abspath(out), w, h, samples, view_id=r[kind], kind=kind, moment=m)
            if r.get("mask"):
                # the panorama's open sky, rendered in the same scene straight after it (render/sky_masks.py): the
                # plants are not laid out the same in two runs, so a mask from another run missed the trees
                sc = plateau.scene
                dome = plateau.night.dome if plateau.night is not None else None
                shown = dome is not None and not dome.hide_render
                sc.render.film_transparent = True
                if shown:
                    dome.hide_render = True
                plateau.render(os.path.abspath(r["mask"]), 1024, 512, 4, view_id=f"{r[kind]} mask", kind=kind, moment=m)
                sc.render.film_transparent = False
                if shown:
                    dome.hide_render = False
            if "patch" in r or r.get("transparent"):
                side = os.path.splitext(os.path.abspath(out))[0] + ".json"
                with open(side, encoding="utf-8") as f:
                    meta = json.load(f)
                meta.update({k: r[k] for k in ("patch", "transparent") if k in r})
                with open(side, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=1)


main()
