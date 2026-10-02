"""
Turn rendered stations into the walkthrough's files.

    python render/publish.py            # build/render/pano/*.png -> apps/walk/pano/*.jpg + apps/walk/stations.json

Every station panorama is rendered with a sidecar (<name>.json, written by
render/giza/scene.py) that records its era, camera and sun; this reads them, converts
the PNGs to web JPEGs, and writes the manifest apps/walk/index.html reads: the eras in
order, and for each station its name, camera, default view, neighbours, the panoramas
it has and its landmarks with a height per era. Plain Python; no Blender.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from giza import data, states  # noqa: E402

PANO_IN = os.path.join(data.REPO, "build", "render", "pano")
WALK = os.path.join(data.REPO, "apps", "walk")
PANO_OUT = os.path.join(WALK, "pano")

# How tall each Sphinx of the sequence stands, as the fitted stand-ins came out (render logs).
SPHINX_HEIGHT = {"anubis": 35.7, "lion": 30.1, "lion-fresh": 21.1, "carved": 25.3, "buried": 24.3, "excavated": 24.3}
SPHINX_BASE = -38.65


def landmarks():
    out = []
    for key in ("g1", "g2", "g3"):
        p = data.PYRAMIDS[key]
        z, height = {}, {}
        for st in states.ORDER:
            h = p["today"] if states.STATES[st]["pyramids"] in ("today", "stripped") else p["H"]
            z[st] = round(p["base"] + h, 2)
            height[st] = round(h, 1)
        out.append({"name": p["name"], "x": round(p["cx"], 2), "y": round(p["cy"], 2), "z": z, "height": height})
    z, height = {}, {}
    for st in states.ORDER:
        h = SPHINX_HEIGHT[states.STATES[st]["sphinx"]]
        visible = h if states.STATES[st]["sphinx"] != "buried" else 10.0
        z[st] = round(SPHINX_BASE + h, 2)
        height[st] = round(visible, 1)
    out.append({"name": "The Sphinx", "x": 337.0, "y": -433.0, "z": z})
    queens = {st: 30.0 if states.STATES[st]["queens"] == "dressed" else 18.0 for st in states.ORDER if states.STATES[st]["queens"]}
    out.append({"name": "Queens' pyramids", "x": 193.0, "y": -92.5, "z": {st: round(-1.7 + h, 1) for st, h in queens.items()}})
    context = {"city": "Giza and Cairo", "village": "The village", None: "The Nile valley"}
    for st in states.ORDER:
        name = context[states.STATES[st]["city"]]
        entry = next((e for e in out if e["name"] == name), None)
        if entry is None:
            entry = {"name": name, "x": 3800.0, "y": 900.0, "z": {}}
            out.append(entry)
        entry["z"][st] = 10.0 if name != "The Nile valley" else -30.0
    return out


STAR_LABELS = ("Alnitak", "Alnilam", "Mintaka", "Sirius")


def star_marks(s, moments, cameras):
    """
    Labels on the claims' stars for a night station: each star's baked altitude and
    azimuth for that era's night, set 20 km out from the camera so the viewer's labels,
    which are points in the frame, land on the star. One entry per era, since the sky of
    10,450 BCE is not the sky of 2450 BCE.
    """
    import math
    path = os.path.join(data.REPO, "build", "sky-bake.json")
    if not os.path.exists(path):
        return []
    with io.open(path, encoding="utf-8") as f:
        bake = json.load(f)
    catalogue = data.load_json(data.DATA, "stars", "hyg-bright.json")
    name_col = catalogue["columns"].index("name")
    index = {row[name_col]: i for i, row in enumerate(catalogue["stars"]) if row[name_col] in STAR_LABELS}
    out = []
    for st, cam in cameras.items():
        m = moments.get(s.get("by_state", {}).get(st, {}).get("moment", s.get("moment")), {})
        night = bake.get("nights", {}).get(m.get("night"))
        if night is None:
            continue
        for name in STAR_LABELS:
            az, alt = (math.radians(v) for v in night["stars"][index[name]][:2])
            if alt <= 0.0:
                continue
            d = 20000.0
            out.append({"name": name, "x": round(cam[0] + d * math.cos(alt) * math.sin(az), 1),
                        "y": round(cam[1] + d * math.cos(alt) * math.cos(az), 1), "z": {st: round(cam[2] + d * math.sin(alt), 1)}})
    return out


# The figures drawn over a night station: Orion and its neighbours down the meridian sky.
SKY_FIGURES = ("Ori", "CMa", "Tau")
SKY_NAMES = ("Alnitak", "Alnilam", "Mintaka", "Betelgeuse", "Rigel", "Sirius", "Aldebaran")
# Bauval's reading: each belt star over its pyramid.
BELT = (("Alnitak", "g1"), ("Alnilam", "g2"), ("Mintaka", "g3"))


def night_sky(s, moments):
    """
    What the walkthrough draws over a night station's sky, per era: the constellation figures
    (Stellarium's modern lines, render/giza/alignments/lines.json) and the named stars, as the sky
    bake's azimuth and altitude for that era's night, and a line from each belt star down to the
    apex of its pyramid. Directions, not points, so the viewer sets them at any distance.
    """
    path = os.path.join(data.REPO, "build", "sky-bake.json")
    if not os.path.exists(path):
        return {}
    with io.open(path, encoding="utf-8") as f:
        bake = json.load(f)
    catalogue = data.load_json(data.DATA, "stars", "hyg-bright.json")
    cols = catalogue["columns"]
    id_col, name_col = cols.index("id"), cols.index("name")
    by_id = {row[id_col]: i for i, row in enumerate(catalogue["stars"])}
    by_name = {row[name_col]: i for i, row in enumerate(catalogue["stars"]) if row[name_col]}
    figures = data.load_json(os.path.join(HERE, "giza", "alignments"), "lines.json")["figures"]
    out = {}
    for st in states.ORDER:
        over = s.get("by_state", {}).get(st, {})
        m = moments.get(over.get("moment", s.get("moment")), {})
        night = bake.get("nights", {}).get(m.get("night"))
        if night is None:
            continue
        stars = night["stars"]
        at = lambda i: [round(stars[i][0], 3), round(stars[i][1], 3)]
        figs = []
        for key in SKY_FIGURES:
            f = figures[key]
            segs = [at(by_id[a]) + at(by_id[b]) for a, b in f["segments"] if a in by_id and b in by_id]
            figs.append({"name": f["name"], "segments": segs})
        names = [{"name": n, "at": at(by_name[n]), "mag": stars[by_name[n]][2]} for n in SKY_NAMES if n in by_name]
        apex = {}
        for key in ("g1", "g2", "g3"):
            p = data.PYRAMIDS[key]
            h = p["today"] if states.STATES[st]["pyramids"] in ("today", "stripped") else p["H"]
            apex[key] = [round(p["cx"], 2), round(p["cy"], 2), round(p["base"] + h, 2)]
        links = [{"star": n, "at": at(by_name[n]), "to": apex[k], "pyramid": data.PYRAMIDS[k]["name"]} for n, k in BELT]
        out[st] = {"label": night.get("label", ""), "figures": figs, "stars": names, "links": links}
    return out


def overlays():
    """
    Figures the guided tour draws over a station, in the project frame, computed here from the survey
    numbers (data.py) and the Earth's figures in data/measurements, so the labels cannot drift from the
    database. `g1-proportions`: the Great Pyramid's south face as built, seen from the station south of
    it, with the ratios the encoded-geometry reading draws from it: pi in perimeter over height, phi in
    slant height over half the side, and the 1:43,200 scale of the Earth.
    """
    import math
    p = data.PYRAMIDS["g1"]
    earth = {x["key"]: x["value"] for x in data.records("units-and-constants.json") if x.get("key", "").startswith("earth.")}
    polar, equator = earth["earth.radius.polar"], earth["earth.circumference.equatorial"]
    h, H, top, z0 = p["half"], p["H"], p["today"], p["base"]
    side, perim = 2 * h, 8 * h
    slant = math.hypot(H, h)
    phi = (1 + math.sqrt(5)) / 2
    apex, se, sw, mid = [0.0, 0.0, z0 + H], [h, -h, z0], [-h, -h, z0], [0.0, -h, z0]
    r = lambda v: [round(c, 2) for c in v]
    km = lambda m: f"{m / 1000:,.0f} km"
    out = {
        "g1-proportions": {
            "lines": [
                {"from": r(sw), "to": r(apex), "style": "edge"},
                {"from": r(apex), "to": r(se), "style": "edge"},
                {"from": r(sw), "to": r(se), "style": "edge"},
                {"from": r(apex), "to": r(mid), "style": "dash"},
            ],
            "labels": [
                {"at": r(apex), "text": f"Height as built {H:.1f} m", "sub": f"× 43,200 = {km(H * 43200)}; the Earth's polar radius is {km(polar)}", "place": "above"},
                {"at": r([0.0, 0.0, z0 + top]), "text": f"Today's top, {top:.1f} m", "sub": f"the top {H - top:.1f} m, capstone and all, is gone", "place": "right", "dy": 34, "eras": ["stripped", "today"]},
                {"at": r([0.0, -h * 0.5, z0 + H * 0.5]), "text": f"Slant height {slant:.1f} m", "sub": f"÷ half the side = {slant / h:.4f}; φ = {phi:.4f}", "place": "left"},
                {"at": r([0.0, -h, z0 + H * 0.14]), "text": f"Perimeter ÷ height = {perim / H:.4f}", "sub": f"2π = {2 * math.pi:.4f}", "place": "center"},
                {"at": r(mid), "text": f"Side {side:.1f} m, perimeter {perim:.1f} m", "sub": f"× 43,200 = {km(perim * 43200)}; the equator is {km(equator)}", "place": "below"},
            ],
        },
    }
    # The rest needs the claims engine's own values: `pnpm tsx scripts/tour-values.ts` writes them.
    path = os.path.join(data.REPO, "build", "tour-values.json")
    if not os.path.exists(path):
        print("  no build/tour-values.json (npx tsx scripts/tour-values.ts): the akhet and passage overlays are left out")
        return out
    with io.open(path, encoding="utf-8") as f:
        v = json.load(f)
    # `akhet` (C6): from the Sphinx, the midsummer sunset of 2500 BCE and the middle of the gap between
    # Khufu's south-west corner and Khafre's north-east corner, at the bearings the claim computes.
    g2 = data.PYRAMIDS["g2"]
    sx, sy, sz = v["sphinx"]["east"], v["sphinx"]["north"], -20.0
    gap = [(p["cx"] - h + g2["cx"] + g2["half"]) / 2, (p["cy"] - h + g2["cy"] + g2["half"]) / 2, 0.0]
    a = math.radians(v["akhet"]["sunsetAzimuth"])
    sun = [sx + 2600 * math.sin(a), sy + 2600 * math.cos(a), sz + 18.0]
    out["akhet"] = {
        "lines": [
            {"from": r([sx, sy, sz]), "to": r(sun), "style": "dash"},
            {"from": r([sx, sy, sz]), "to": r(gap), "style": "faint"},
        ],
        "suns": [{"at": r(sun), "radius": 16}],
        "labels": [
            {"at": r(sun), "text": "The midsummer sun sets here, seen from the Sphinx", "sub": f"2500 BCE: bearing {v['akhet']['sunsetAzimuth']:.1f}°, the gap's middle {v['akhet']['gapAzimuth']:.1f}°", "place": "above", "dy": -66},
        ],
    }
    # `passage` (C3): the descending passage from the chamber's north mouth to its foot, then up its
    # slope towards the pole star's lowest crossing of the meridian.
    rec = {}
    for name in ("g1.json", "g1-interior.json"):
        rec.update({x["key"]: x.get("value") for x in data.records(name)})
    mouth = [rec["passage.subterranean_north.end.east"], rec["passage.subterranean_north.end.north"], rec["passage.subterranean_north.end.up"] + 0.6]
    foot = [rec["passage.descending.floor.end.east"], rec["passage.descending.floor.end.north"], rec["passage.descending.floor.end.up"] + 0.6]
    slope = math.radians(v["passage"]["angle"])
    up = [foot[0], foot[1] + 120 * math.cos(slope), foot[2] + 120 * math.sin(slope)]
    out["passage"] = {
        "lines": [
            {"from": r(mouth), "to": r(foot), "style": "dash"},
            {"from": r(foot), "to": r(up), "style": "dash"},
        ],
        "labels": [
            {"at": r(mouth), "text": "To the descending passage", "sub": f"{foot[1] - mouth[1]:.0f} m north, then up through the rock", "place": "below"},
            {"at": r(up), "text": f"Up the passage at {v['passage']['angle']:.2f}°, to the north sky", "sub": "where Thuban, the pole star of its age, crossed at its lowest", "place": "above"},
        ],
    }
    # `valley-hall`: what the granite hall's walls are, as the older-Giza reading has them (directions
    # from the station's camera, so the callouts sit on the walls in view).
    out["valley-hall"] = {
        "lines": [],
        "labels": [
            {"at": {"dir": [250, 16, 9]}, "text": "Red granite from Aswan", "sub": "the facing; Schoch and West argue it was cut to fit worn stone", "place": "center"},
            {"at": {"dir": [290, -6, 7]}, "text": "Behind it, limestone", "sub": "quarried from the Sphinx's ditch, weathered by rain, argue Schoch and West", "place": "center"},
        ],
    }
    # `kc-shaft`: the King's Chamber's southern shaft from its mouth through the masonry to the outlet
    # on the south face and on into the sky, from Gantenbrink's segments (data/measurements/g1-interior.json).
    rec = {}
    for name in sorted(os.listdir(os.path.join(data.DATA, "measurements"))):
        if name.startswith("g1") and name.endswith(".json"):
            rec.update({x["key"]: x.get("value") for x in data.records(name) if "key" in x})
    px, py, pz = rec["kc.shaft.south.outlet.east"], rec["kc.wall.south.north"], rec["kc.floor.elevation"] + rec["kc.shaft.south.inlet.from_floor"]
    pts = [[px, py, pz]]
    for k in (1, 2, 3):
        a, d = math.radians(rec[f"kc.shaft.south.segment.{k}.angle"]), rec[f"kc.shaft.south.segment.{k}.length"]
        py, pz = py - d * math.cos(a), pz + d * math.sin(a)
        pts.append([px, py, pz])
    a = math.radians(rec["kc.shaft.south.angle"])
    run = (rec["kc.shaft.south.outlet.up"] - pz) / math.tan(a)
    outlet = [px, py - run, rec["kc.shaft.south.outlet.up"]]
    pts.append(outlet)
    sky = [px, outlet[1] - 60 * math.cos(a), outlet[2] + 60 * math.sin(a)]
    out["kc-shaft"] = {
        "lines": [{"from": r(pts[i]), "to": r(pts[i + 1]), "style": "dash"} for i in range(len(pts) - 1)]
                 + [{"from": r(outlet), "to": r(sky), "style": "edge"}],
        "labels": [
            {"at": r(pts[0]), "text": "The southern shaft", "sub": f"{rec['kc.shaft.south.width'] * 100:.0f} by {rec['kc.shaft.south.height'] * 100:.0f} cm, climbing through the masonry", "place": "below", "dy": 40},
            {"at": r(sky), "text": f"Out of the south face at {rec['kc.shaft.south.angle']:.0f}°", "sub": "to Alnitak, in Orion's belt, crossing the meridian around 2450 BCE", "place": "above"},
        ],
    }
    return out


def in_shadow(png):
    """
    Whether the camera seems to stand in a shadow: the ground under it both dark against
    the lit ground near the horizon and blue, lit by the sky alone. Darkness alone is not
    enough: grass, black basalt and silty water are dark in full sun, but warm. Returns
    (darkness ratio, blue over red); a shadow comes out below 0.45 and above 0.95.
    """
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(png).convert("RGB").resize((512, 256)), dtype=float)
    h = a.shape[0]
    under = a[int(h * 0.92):, :, :]
    ratio = under.mean() / max(1.0, np.percentile(a[int(h * 0.505):int(h * 0.53), :, :].mean(2), 80))
    return ratio, under[:, :, 2].mean() / max(1.0, under[:, :, 0].mean())


def main():
    from PIL import Image
    stations_src = data.load_json(HERE, "stations.json")
    moments = stations_src["moments"]
    os.makedirs(PANO_OUT, exist_ok=True)
    marks = landmarks()
    manifest = {"states": [{"id": st, "label": states.STATES[st]["label"], "title": states.STATES[st]["title"],
                            "honesty": states.STATES[st]["honesty"]} for st in states.ORDER],
                "stations": []}
    for s in stations_src["stations"]:
        panos, cameras, camera, titles = {}, {}, None, {}
        for st in states.ORDER:
            png = os.path.join(PANO_IN, f"{s['id']}-{st}.png")
            side = os.path.join(PANO_IN, f"{s['id']}-{st}.json")
            if not os.path.exists(png):
                continue
            jpg_name = f"{s['id']}-{st}.jpg"
            jpg = os.path.join(PANO_OUT, jpg_name)
            if not os.path.exists(jpg) or os.path.getmtime(jpg) < os.path.getmtime(png):
                Image.open(png).convert("RGB").save(jpg, quality=82, optimize=True, progressive=True)   # 82 keeps a whole walkthrough under the 64 MB a page may carry
                print(f"  {jpg_name}: {os.path.getsize(jpg) / 1e6:.2f} MB")
            panos[st] = f"pano/{jpg_name}"
            if os.path.exists(side):
                with io.open(side, encoding="utf-8") as f:
                    cameras[st] = json.load(f)["camera"]
                if camera is None or st == "today":
                    camera = cameras[st]
            over = s.get("by_state", {}).get(st, {})
            by_night = "night" in moments.get(over.get("moment", s.get("moment")), {})
            if not (s.get("inside") or s.get("hall")) and not by_night:
                dark, blue = in_shadow(png)
                if dark < 0.45 and blue > 0.95:        # grey basalt in sun reads 0.9; sky-lit shade 1.8 and more
                    print(f"  WARNING: {s['id']}-{st}: the ground under the camera is {dark:.2f} of the lit ground and blue "
                          f"({blue:.2f}): in a shadow?")
            if "name" in over or "where" in over or "moment" in over:
                titles[st] = {"name": over.get("name", s["name"]), "where": over.get("where", s.get("where", ""))}
                if "moment" in over:
                    titles[st]["moment"] = moments.get(over["moment"], {}).get("label", "")
        if not panos:
            print(f"{s['id']}: nothing rendered yet; left out")
            continue
        m = moments.get(s.get("moment"), {})
        entry = {
            "id": s["id"], "name": s["name"], "where": s.get("where", ""), "moment": m.get("label", s.get("light", "")),
            "camera": camera or [s["x"], s["y"], s.get("z", 0.0)],
            "view": s.get("view", {"yaw": 0, "pitch": 4, "fov": 58}),
            "panoramas": panos,
            "neighbours": [n for n in s.get("neighbours", [])],
            # An inside station (in the pyramid, or in a temple's hall) names what is round it; the plateau's landmarks are behind the walls.
            "landmarks": s["landmarks"] if (s.get("inside") or s.get("hall")) else marks + star_marks(s, moments, cameras),
        }
        if len({tuple(c) for c in cameras.values()}) > 1:
            entry["cameras"] = cameras
        if titles:
            entry["titles"] = titles
        if s.get("inside") or s.get("hall"):
            entry["inside"] = True
        sky = {st: v for st, v in night_sky(s, moments).items() if st in panos}
        if sky:
            entry["sky"] = sky
        manifest["stations"].append(entry)
        print(f"{s['id']}: {', '.join(panos)}")
    ids = {st["id"] for st in manifest["stations"]}
    for st in manifest["stations"]:
        st["neighbours"] = [n for n in st["neighbours"] if n in ids]
    with io.open(os.path.join(WALK, "stations.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    figures = overlays()   # computed first, so a failure leaves the old file whole
    with io.open(os.path.join(WALK, "overlays.json"), "w", encoding="utf-8") as f:
        json.dump(figures, f, indent=1, ensure_ascii=False)
    print(f"wrote apps/walk/stations.json: {len(manifest['stations'])} stations")


if __name__ == "__main__":
    main()
