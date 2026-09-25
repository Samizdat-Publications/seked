"""
Everything the generator reads from data/, with numpy and json only. bpy-free.

The pyramids take their survey numbers from data/measurements; where a record
carries several sources the value used is named here with the source it came from,
so a reader can check it without running anything.
"""
import io
import json
import math
import os

import numpy as np

from .noise import bicubic

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(REPO, "data")
RENDER = os.path.join(REPO, "render")


def load_json(*parts):
    with io.open(os.path.join(*parts), encoding="utf-8") as f:
        return json.load(f)


def records(name):
    d = load_json(DATA, "measurements", name)
    return d if isinstance(d, list) else d["records"]


def site_origin_elevation(site_id="giza"):
    for site in load_json(DATA, "sites.json"):
        if site["id"] == site_id:
            return float(site["origin"]["elevation"])
    raise KeyError(site_id)


ORIGIN_ELEVATION = site_origin_elevation()

# Goyon's 201 course heights at the north-east corner (data/measurements/g1-courses.json);
# they sum to 138.745 m, the Great Pyramid's height today.
G1_COURSES = [r["value"] for r in records("g1-courses.json")]


class Grid:
    """A GLO-30 height grid in the project frame (data/terrain/*.json header)."""

    def __init__(self, name):
        self.header = load_json(DATA, "terrain", name + ".json")
        h = self.header
        self.heights = np.fromfile(os.path.join(DATA, "terrain", h["heights"]), dtype="<f4").reshape(h["ny"], h["nx"])

    def sample(self, x, y):
        """Height above the site origin (the Great Pyramid's base), bicubic, metres."""
        h = self.header
        x = np.asarray(x, np.float32)
        y = np.asarray(y, np.float32)
        return bicubic(self.heights, (x - h["x0"]) / h["spacing"], (y - h["y0"]) / h["spacing"]) - ORIGIN_ELEVATION


NEAR = Grid("giza-glo30")        # +-3 km at 20 m
FAR = Grid("giza-glo30-far")     # +-12 km at 60 m


def ring_median(cx, cy, radius, grid=NEAR):
    a = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    return float(np.median(grid.sample(cx + radius * np.cos(a), cy + radius * np.sin(a))))


# GLO-30's ground round Khufu does not sit at the site's nominal elevation of 60 m;
# the whole terrain is shifted so the ground meets Khufu's base at z = 0.
TERRAIN_SHIFT = -ring_median(0.0, 0.0, 150.0)

# The three pyramids. Centres from data/measurements/g2-g3-sphinx.json (offsets from
# Khufu's centre); sides and heights from the sources named beside each value.
PYRAMIDS = {
    "g1": dict(name="Khufu", cx=0.0, cy=0.0, half=230.33 / 2, H=146.59, today=sum(G1_COURSES), base=0.0,
               note="side 230.33 m and height 146.59 m (Cole via Lehner), height today = sum of Goyon's courses"),
    "g2": dict(name="Khafre", cx=-334.41, cy=-353.86, half=215.25 / 2, H=143.5, today=136.4, base=10.0,
               cap_depth=42.5, granite_to=1.05,
               note="side 215.25 m, height 143.5 m, today 136.40 m, base +10 m, casing cap 42.5 m (M&R Parte V p. 51)"),
    "g3": dict(name="Menkaure", cx=-574.45, cy=-739.19, half=104.6 / 2, H=65.0, today=61.87, base=None,
               granite_to=16.39,
               note="side 104.6 m (east-west), height 65.0 m, today 61.87 m, granite casing to 16.39 m (Vyse)"),
}
PYRAMIDS["g3"]["base"] = ring_median(PYRAMIDS["g3"]["cx"], PYRAMIDS["g3"]["cy"], 75.0) + TERRAIN_SHIFT

FOOTPRINTS = load_json(DATA, "footprints", "giza.json")["features"]


def queens():
    """The queens' pyramids of Khufu and Menkaure, from the OSM footprints."""
    out = []
    for f in FOOTPRINTS:
        if f["id"] not in ("g1a", "g1b", "g1c", "g3a", "g3b", "g3c"):
            continue
        r = f["ring"]
        cx = sum(p[0] for p in r) / len(r)
        cy = sum(p[1] for p in r) / len(r)
        half = math.sqrt(f["area"]) / 2
        # G3's queens carry no registered base level in the footprint file; read it off the ground.
        base = f["base"] if f["id"].startswith("g1") else ring_median(cx, cy, half * 1.35) + TERRAIN_SHIFT
        out.append(dict(name=f["id"], cx=cx, cy=cy, half=half, H=f["height"], base=base))
    return out


QUEENS = queens()


def mastabas():
    """Each mastaba as an oriented rectangle: centre, yaw, length, width, height, base."""
    out = []
    for f in FOOTPRINTS:
        if f.get("group") != "mastabas":
            continue
        pts = np.array(f["ring"], dtype=np.float64)
        c = pts.mean(0)
        _, vecs = np.linalg.eigh(np.cov((pts - c).T))
        ax = vecs[:, 1]
        yaw = math.atan2(ax[1], ax[0])
        R = np.array([[math.cos(-yaw), -math.sin(-yaw)], [math.sin(-yaw), math.cos(-yaw)]])
        loc = (pts - c) @ R.T
        out.append(dict(cx=float(c[0]), cy=float(c[1]), yaw=yaw, length=max(float(np.ptp(loc[:, 0])), 2.5),
                        width=max(float(np.ptp(loc[:, 1])), 2.5), height=f.get("height") or 4.0,
                        base=f.get("base")))
    return out


def city_boxes():
    """Open Buildings boxes: x, y, width, depth, yaw (deg from east), height."""
    raw = np.fromfile(os.path.join(DATA, "footprints", "city.bin"), dtype="<f4").reshape(-1, 7)
    return raw[:, :6]


def views():
    """The stations and shots the walkthrough renders (render/stations.json, render/shots.json)."""
    return load_json(RENDER, "stations.json"), load_json(RENDER, "shots.json")
