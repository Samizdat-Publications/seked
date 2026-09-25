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
SPHINX_HEIGHT = {"anubis": 35.7, "lion": 30.1, "carved": 25.3, "buried": 24.3, "excavated": 24.3}
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


def in_shadow(png):
    """
    How dark the ground under the camera is against the sunlit ground near the horizon.
    A station lit by the sky alone, or standing over dark water, comes out below about
    0.38; a lit one, even on stony ground in raking light, above 0.44.
    """
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(png).convert("L").resize((512, 256)), dtype=float)
    h = a.shape[0]
    return a[int(h * 0.92):, :].mean() / max(1.0, np.percentile(a[int(h * 0.505):int(h * 0.53), :], 80))


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
                Image.open(png).convert("RGB").save(jpg, quality=86, optimize=True, progressive=True)
                print(f"  {jpg_name}: {os.path.getsize(jpg) / 1e6:.2f} MB")
            panos[st] = f"pano/{jpg_name}"
            if os.path.exists(side):
                with io.open(side, encoding="utf-8") as f:
                    cameras[st] = json.load(f)["camera"]
                if camera is None or st == "today":
                    camera = cameras[st]
            if not s.get("inside"):
                dark = in_shadow(png)
                if dark < 0.38:
                    print(f"  WARNING: {s['id']}-{st}: the ground under the camera is {dark:.2f} of the lit ground; "
                          "in shadow or over dark water?")
            over = s.get("by_state", {}).get(st, {})
            if "name" in over or "where" in over:
                titles[st] = {"name": over.get("name", s["name"]), "where": over.get("where", s.get("where", ""))}
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
            # An inside station names what is round it; the plateau's landmarks are behind the walls.
            "landmarks": s["landmarks"] if s.get("inside") else marks,
        }
        if len({tuple(c) for c in cameras.values()}) > 1:
            entry["cameras"] = cameras
        if titles:
            entry["titles"] = titles
        if s.get("inside"):
            entry["inside"] = True
        manifest["stations"].append(entry)
        print(f"{s['id']}: {', '.join(panos)}")
    ids = {st["id"] for st in manifest["stations"]}
    for st in manifest["stations"]:
        st["neighbours"] = [n for n in st["neighbours"] if n in ids]
    with io.open(os.path.join(WALK, "stations.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print(f"wrote apps/walk/stations.json: {len(manifest['stations'])} stations")


if __name__ == "__main__":
    main()
