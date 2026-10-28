"""
Re-render every published panorama and detail patch of some eras, after a change that alters all of them (new
plants, a new ground): what scripts/exhibit_queue.py would queue if none of them were on disk, plus the walkthrough's
own panoramas no leaf uses, each panorama with its sky mask where a leaf draws a live sky over it (render/sky_masks.py),
panoramas first so every patch is newer than the panorama it lays into.

    python scripts/era_queue.py first-time lion          # build/jobs/q-eras-<eras>.json
    blender -b --factory-startup -P render/build.py -- --queue build/jobs/q-eras-first-time-lion.json
    python render/sky_masks.py write
    python render/publish.py

Stdlib only. Renders nothing.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
sys.path.insert(0, os.path.join(ROOT, "render"))
import exhibit_queue as eq  # noqa: E402
import sky_masks  # noqa: E402

ERAS = ("first-time", "lion", "built", "stripped", "buried", "excavated", "today")


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def queue(eras):
    leaves = load("apps/exhibit/leaves.json")["leaves"]
    render = load("render/stations.json")
    none = lambda p: False
    masked = {os.path.splitext(os.path.basename(p))[0] for p in sky_masks.panoramas()[0]}
    panos, names = [], set()
    for r in eq.pano_queue(leaves, render, none):
        if r["state"] not in eras:
            continue
        name = os.path.splitext(os.path.basename(r["out"]))[0]
        names.add(name)
        if eq.station_moment(render, r["station"], r["state"]) is None:
            r.pop("moment", None)                # inside: no moment, as sky_masks and patch_queue give it
        if name in masked:
            r["mask"] = f"build/render/sky-mask/{name}.png"
        panos.append(r)
    # the walkthrough's own panoramas, <station>-<era>.jpg, that no leaf asks for
    stations = {st["id"] for st in render["stations"]}
    for f in sorted(os.listdir(os.path.join(ROOT, "apps", "walk", "pano"))):
        name, ext = os.path.splitext(f)
        era = next((e for e in eras if name.endswith("-" + e)), None)
        if ext != ".jpg" or era is None or name in names:
            continue
        station = name[: -len(era) - 1]
        if station not in stations:
            continue
        panos.append({"state": era, "station": station, "out": f"apps/walk/pano/{name}.png", "for": "walk"})
    patches = [r for r in eq.patch_queue(leaves, render, none) if r["state"] in eras]
    return panos, patches


def main():
    eras = [e for e in sys.argv[1:] if e in ERAS]
    if not eras:
        raise SystemExit(f"name the eras: {', '.join(ERAS)}")
    panos, patches = queue(eras)
    path = os.path.join(ROOT, "build", "jobs", f"q-eras-{'-'.join(eras)}.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"about": f"every published panorama and patch of {', '.join(eras)}, re-rendered (scripts/era_queue.py)",
                   "renders": panos + patches}, f, indent=1)
    print(f"{len(panos)} panoramas ({sum('mask' in r for r in panos)} with sky masks) and {len(patches)} patches into {path}")


if __name__ == "__main__":
    main()
