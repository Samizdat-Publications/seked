"""
The exhibit's render queue, written from its leaves (apps/exhibit/leaves.json), so adding a leaf never means
writing a render by hand. Run it after changing the leaves; it renders nothing.

    python scripts/exhibit_queue.py

Writes:

- render/queues/exhibit-panos.json: each leaf's panorama (its station in its era and moment) that
  apps/walk/pano/ lacks. A leaf lit at the moment its station is rendered at for the walkthrough uses the
  walkthrough's own file (pano/<station>-<era>.jpg); any other moment is its own file,
  pano/<station>-<era>-<moment>.jpg, which render/publish.py makes from build/render/pano/. The naming is
  apps/exhibit/src/leaves.ts's leafPanorama; render/tests/test_exhibit_queue.py keeps the two in step.
- render/films-exhibit.json: a flight for each leaf that arrives by flight, from the last leaf's station camera
  and view to this one's, in the arriving leaf's era and moment, about 3 s at 30 fps, 1920 by 1080, 64 samples,
  along an eased path that rises over what lies between. Its id is <from-leaf>--<to-leaf>, the file the player
  plays (apps/exhibit/flights/<id>.mp4).

Render and encode on the laptop:

    blender -b --factory-startup -P render/build.py -- --queue render/queues/exhibit-panos.json
    python render/publish.py
    blender -b --factory-startup -P render/build.py -- --films render/films-exhibit.json --film ch0-sunrise--ch0-behind
    blender -b --factory-startup -P render/film.py -- encode --frames build/films/ch0-sunrise--ch0-behind/frames --fps 30 --out apps/exhibit/flights/ch0-sunrise--ch0-behind.mp4

Stdlib only, as the render scripts are.
"""
import io
import json
import math
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FPS, SECONDS, SIZE, SAMPLES = 30, 3, "1920x1080", 64
SENSOR = 36.0          # render/giza/cameras.frame: a 36 mm sensor across the wider side
LOOK_AHEAD = 60.0      # metres along the view to the point the camera looks at


def load(path):
    with io.open(os.path.join(REPO, path), encoding="utf-8") as f:
        return json.load(f)


def station_moment(render, station, era):
    """The moment a station is rendered at in an era for the walkthrough: its by_state moment, else its own."""
    st = next((s for s in render["stations"] if s["id"] == station), None)
    if st is None:
        return None
    return st.get("by_state", {}).get(era, {}).get("moment", st.get("moment"))


def leaf_panorama(leaf, render):
    """The panorama a leaf needs, relative to apps/walk/ (leaves.ts's leafPanorama)."""
    if station_moment(render, leaf["station"], leaf["era"]) == leaf["moment"]:
        return f"pano/{leaf['station']}-{leaf['era']}.jpg"
    return f"pano/{leaf['station']}-{leaf['era']}-{leaf['moment']}.jpg"


def pano_queue(leaves, render, have):
    """The renders for leaf panoramas not on disk; `have(path)` says whether apps/walk/<path> exists."""
    out, seen = [], set()
    for L in leaves:
        path = leaf_panorama(L, render)
        if path in seen or have(path):
            continue
        seen.add(path)
        name = os.path.splitext(os.path.basename(path))[0]
        out.append({"state": L["era"], "station": L["station"], "moment": L["moment"],
                    "out": f"build/render/pano/{name}.png", "for": L["id"]})
    return out


def lens_for(vfov_deg, aspect=16 / 9):
    """The focal length that gives a landscape frame of `aspect` this vertical field on a 36 mm wide sensor."""
    half_h = math.atan(math.tan(math.radians(vfov_deg) / 2) * aspect)
    return (SENSOR / 2) / math.tan(half_h)


def ahead(camera, view, d=LOOK_AHEAD):
    """The point `d` metres along a view (yaw clockwise from north, pitch up, degrees) from a camera."""
    yaw, pitch = math.radians(view["yaw"]), math.radians(view["pitch"])
    return (camera[0] + d * math.cos(pitch) * math.sin(yaw), camera[1] + d * math.cos(pitch) * math.cos(yaw),
            camera[2] + d * math.sin(pitch))


def rise_for(distance):
    """How far above the higher end a flight climbs at its middle: a quarter of the way, 8 m to 60 m."""
    return min(60.0, max(8.0, 0.25 * distance))


def flight_path(a, b):
    """
    Control points for a flight from camera a to camera b (render/build.py runs a Catmull-Rom curve through
    them, eased in and out): it lifts off nearly straight up, crosses high, and comes down steeply onto b, so
    it clears the walls and the ditch's rim between two stations without knowing where they are.
    """
    d = math.dist(a[:2], b[:2])
    top = max(a[2], b[2]) + rise_for(d)
    lerp = lambda t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    p1, p2, p3 = lerp(0.12), lerp(0.5), lerp(0.9)
    return [list(a), [p1[0], p1[1], a[2] + 0.55 * (top - a[2])], [p2[0], p2[1], top],
            [p3[0], p3[1], b[2] + 0.6 * (top - b[2])], list(b)]


def flight(prev, leaf, cameras):
    """The film of the flight into `leaf` from `prev`; `cameras(station, era)` gives a station's camera."""
    a, b = cameras(prev["station"], leaf["era"]), cameras(leaf["station"], leaf["era"])
    path = flight_path(a, b)
    la, lb = ahead(a, prev["view"]), ahead(b, leaf["view"])
    mid = [(la[0] + lb[0]) / 2, (la[1] + lb[1]) / 2, (la[2] + lb[2]) / 2]
    r = lambda v: [round(c, 2) for c in v]
    return {
        "id": f"{prev['id']}--{leaf['id']}",
        "name": f"Flight into {leaf['id']} from {prev['id']}",
        "state": leaf["era"], "moment": leaf["moment"],
        "fps": FPS, "seconds": SECONDS, "size": SIZE, "samples": SAMPLES,
        "lens": [round(lens_for(prev["view"]["fov"]), 2), round(lens_for(leaf["view"]["fov"]), 2)],
        "centre": [round((a[0] + b[0]) / 2, 1), round((a[1] + b[1]) / 2, 1)],
        "path": [r(p) for p in path],
        "look": [r(la), r(mid), r(lb)],
        "out": f"apps/exhibit/flights/{prev['id']}--{leaf['id']}.mp4",
    }


def films(leaves, cameras):
    return [flight(leaves[i - 1], L, cameras) for i, L in enumerate(leaves) if i > 0 and L["arrive"] == "flight"]


def walk_cameras(walk):
    """A station's camera in an era from apps/walk/stations.json (render/publish.py's record of where it stood)."""
    by_id = {s["id"]: s for s in walk["stations"]}

    def camera(station, era):
        s = by_id[station]
        return list((s.get("cameras") or {}).get(era) or s["camera"])
    return camera


def main():
    leaves = load("apps/exhibit/leaves.json")["leaves"]
    render = load("render/stations.json")
    walk = load("apps/walk/stations.json")
    have = lambda p: os.path.exists(os.path.join(REPO, "apps", "walk", p))
    panos = pano_queue(leaves, render, have)
    queue = {
        "about": "Written by scripts/exhibit_queue.py from apps/exhibit/leaves.json: each leaf's panorama that apps/walk/pano/ "
                 "lacks, its station in its era and moment. Render with render/build.py --queue, then python render/publish.py.",
        "renders": panos,
    }
    flights = {
        "about": "Written by scripts/exhibit_queue.py from apps/exhibit/leaves.json: a flight into each leaf that arrives by flight, "
                 "from the last leaf's station camera and view to this one's, in the arriving leaf's era and moment, so its last "
                 "frame is the leaf's panorama at the leaf's view. Render with render/build.py --films render/films-exhibit.json "
                 "--film ID (try --preview 0,45,89 first), encode with render/film.py into `out`.",
        "films": films(leaves, walk_cameras(walk)),
    }
    for path, doc in (("render/queues/exhibit-panos.json", queue), ("render/films-exhibit.json", flights)):
        with io.open(os.path.join(REPO, path), "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, indent=1, ensure_ascii=False)
            f.write("\n")
    print(f"{len(panos)} panoramas to render into render/queues/exhibit-panos.json")
    for r in panos:
        print(f"  {r['station']} {r['state']} at {r['moment']} (for {r['for']})")
    print(f"{len(flights['films'])} flights into render/films-exhibit.json")
    for f in flights["films"]:
        print(f"  {f['id']}")


if __name__ == "__main__":
    sys.exit(main())
