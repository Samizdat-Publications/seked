"""
Detail patches for the tour's close views.

A station's panorama is 4096 pixels round, about 11 to the degree. A tour stop that looks
through a long lens (the intro at 24 degrees, the akhet at 50) shows the visitor 20 to 60
pixels to the degree, so the panorama is enlarged two to five times and reads soft. A patch
is the same station, in the same era and the same light, rendered through a lens that covers
the stop's view with room to spare; apps/walk lays it over the panorama and feathers its edges.

    python render/patches.py              # writes render/queues/patches.json from apps/walk/tour.json
    python scripts/job.py start patches --then "..." -- blender -b --factory-startup -P render/build.py -- --queue render/queues/patches.json
    python render/publish.py              # picks up build/render/patch/*.png

A stop gets a patch when a 1440-line screen would show it more than 1.5 times enlarged, and
it does not pan (a pan runs off the patch).
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PANO_PX_PER_DEG = 4096 / 360.0
SCREEN_LINES = 1440
CARD = 0.25         # the tour card's right edge over the screen's width, as apps/walk's lookAt centres beside it
ASPECT = 2.0        # wide enough for a 16:9 screen with the card's shift and some turning room
MARGIN = 1.12       # the patch's vertical field over the stop's
LINES = 1800        # the patch's height in pixels


def enlargement(fov):
    """How many times a stop at this vertical field enlarges the panorama on a SCREEN_LINES screen."""
    screen = (SCREEN_LINES / 2) / math.tan(math.radians(fov) / 2) * math.radians(1)
    return screen / PANO_PX_PER_DEG


def centre(view):
    """The bearing of the screen's middle when lookAt sets this view beside the card (16:9)."""
    f = math.radians(view["fov"])
    return view["yaw"] - math.degrees(math.atan(CARD * math.tan(f / 2) * (16 / 9)))


def patches(tour):
    out = []
    for stop in tour["stops"]:
        v = stop.get("view")
        if not v or stop.get("pan") or enlargement(v["fov"]) < 1.5:
            continue
        p = {"yaw": round(centre(v), 2), "pitch": v.get("pitch", 0), "fov": round(v["fov"] * MARGIN, 2), "aspect": ASPECT}
        for era in stop["eras"]:
            out.append({"state": era, "station": stop["station"], "patch": dict(p, stop=stop["id"]),
                        "size": f"{int(LINES * ASPECT)}x{LINES}", "samples": 96,
                        "out": f"build/render/patch/{stop['station']}-{era}-{stop['id']}.png"})
    return out


def main():
    with open(os.path.join(REPO, "apps", "walk", "tour.json"), encoding="utf-8") as f:
        tour = json.load(f)
    renders = patches(tour)
    # one Blender run builds each era once, so the queue is grouped by era
    order = []
    for r in renders:
        if r["state"] not in order:
            order.append(r["state"])
    renders.sort(key=lambda r: order.index(r["state"]))
    q = {"about": "Detail patches for the tour's close views (render/patches.py).", "renders": renders}
    with open(os.path.join(HERE, "queues", "patches.json"), "w", encoding="utf-8") as f:
        json.dump(q, f, indent=1)
    for r in renders:
        print(f"{r['station']:>14} {r['state']:<11} {r['patch']['stop']:<8} yaw {r['patch']['yaw']:7.2f} fov {r['patch']['fov']}")
    print(f"wrote render/queues/patches.json: {len(renders)} patches")


if __name__ == "__main__":
    main()
