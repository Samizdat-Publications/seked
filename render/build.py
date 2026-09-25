"""
Build the plateau in Blender and render views of it.

    blender -b --factory-startup -P render/build.py -- --state today --station south
    blender -b --factory-startup -P render/build.py -- --state built --shot panorama --size 1920x1080 --samples 128
    blender -b --factory-startup -P render/build.py -- --queue render/queues/spike.json
    blender -b --factory-startup -P render/build.py -- --film approach-built      # render/films.json

A queue is {"renders": [{"state", "station" | "shot", "moment"?, "size"?, "samples"?, "out"?}, ...]};
each state is built once and every view in it rendered from the same scene.
Outputs default to build/render/<view>-<state>.png.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import data  # noqa: E402
from giza.scene import Plateau  # noqa: E402

DEFAULTS = {"station": {"size": "4096x2048", "samples": 48}, "shot": {"size": "1920x1080", "samples": 128}}


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
    with io.open(os.path.join(HERE, "films.json"), encoding="utf-8") as f:
        spec = next(x for x in json.load(f)["films"] if x["id"] == film_id)
    stations, _ = data.views()
    plateau = Plateau(spec["state"], aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)))
    cx, cy = spec["centre"]
    where = {"id": film_id, "x": cx, "y": cy, "eye": 1.7, "target": list(spec["look"][-1]), "lens": spec["lens"]}
    if spec.get("inside"):
        # Inside the pyramid: the era's lamps and the inside exposure, no sun to set.
        where.update(inside=True, z=spec["path"][0][2])
    plateau.view(where, "shot")
    if not spec.get("inside"):
        plateau.moment(stations["moments"][spec["moment"]])
    # The camera alone moves, so Cycles keeps the scene between frames instead of rebuilding it for each.
    plateau.scene.render.use_persistent_data = True
    w, h = (int(n) for n in spec["size"].split("x"))
    n = int(spec["fps"] * spec["seconds"])
    frames = os.path.join(data.REPO, "build", "films", film_id, "frames")
    os.makedirs(frames, exist_ok=True)
    for k in range(n):
        out = os.path.join(frames, f"frame_{k:04d}.png")
        if os.path.exists(out):
            continue
        t = k / (n - 1)
        t = t * t * (3 - 2 * t)                    # ease in and out
        cameras.frame(plateau.camera, _catmull(spec["path"], t), _catmull(spec["look"], t), spec["lens"])
        plateau.render(out, w, h, int(spec["samples"]), view_id=f"{film_id} {k}", kind="film", moment=spec["moment"])
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
    with io.open(os.path.join(HERE, "films.json"), encoding="utf-8") as f:
        spec = next(x for x in json.load(f)["films"] if x["id"] == film_id)
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


def main():
    opts = parse(sys.argv)
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
            plateau.view(v, kind)
            m = r.get("moment", v.get("moment"))
            if m is not None:
                plateau.moment(moments[m] if isinstance(m, str) else m)
            w, h = (int(n) for n in str(r.get("size", DEFAULTS[kind]["size"])).split("x"))
            samples = int(r.get("samples", DEFAULTS[kind]["samples"]))
            out = r.get("out") or os.path.join(data.REPO, "build", "render", f"{r[kind]}-{state}.png")
            plateau.render(os.path.abspath(out), w, h, samples, view_id=r[kind], kind=kind, moment=m)


main()
