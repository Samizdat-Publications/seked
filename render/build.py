"""
Build the plateau in Blender and render views of it.

    blender -b --factory-startup -P render/build.py -- --state today --station south
    blender -b --factory-startup -P render/build.py -- --state built --shot panorama --size 1920x1080 --samples 128
    blender -b --factory-startup -P render/build.py -- --queue render/queues/spike.json

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


def main():
    opts = parse(sys.argv)
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
            plateau.view(v, kind)
            m = r.get("moment", v.get("moment"))
            plateau.moment(moments[m] if isinstance(m, str) else m)
            w, h = (int(n) for n in str(r.get("size", DEFAULTS[kind]["size"])).split("x"))
            samples = int(r.get("samples", DEFAULTS[kind]["samples"]))
            out = r.get("out") or os.path.join(data.REPO, "build", "render", f"{r[kind]}-{state}.png")
            plateau.render(os.path.abspath(out), w, h, samples)


main()
