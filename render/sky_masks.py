"""
The open sky of every panorama the exhibit draws a live sky over: a small equirectangular mask (alpha 0 where the
picture is sky, 255 where it is ground, trees, a statue), so the stars and figures are drawn only where the sky shows
and not over the trees as a layer laid on the picture (Stewart, 25 October).

    python render/sky_masks.py queue      # build/jobs/q-sky-masks.json: each such panorama, with its mask
    blender -b --factory-startup -P render/build.py -- --queue build/jobs/q-sky-masks.json
    python render/sky_masks.py write      # apps/walk/pano/mask/<panorama>.png from those renders
    python render/publish.py              # the panoramas themselves

Each mask is rendered in the same Blender session straight after its panorama (build.py's `mask`): the plants are
not laid out identically in two runs, and a mask from a separate run missed the trees.

The panoramas are the leaves' own (scripts/exhibit_queue.py's leaf_panorama), so the mask is the same view, station,
era and moment as the picture under it. The render's alpha is thresholded at a half; the haze over a far horizon
stays sky. Standard library and Pillow only.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import exhibit_queue as eq  # noqa: E402

RENDERS = os.path.join(ROOT, "build", "render", "sky-mask")
OUT = os.path.join(ROOT, "apps", "walk", "pano", "mask")


def panoramas():
    """{panorama path: a leaf that draws a sky over it}, for every leaf with a live sky."""
    with open(os.path.join(ROOT, "apps", "exhibit", "leaves.json"), encoding="utf-8") as f:
        leaves = json.load(f)["leaves"]
    with open(os.path.join(ROOT, "render", "stations.json"), encoding="utf-8") as f:
        render = json.load(f)
    out = {}
    for L in leaves:
        if L.get("sky"):
            out.setdefault(eq.leaf_panorama(L, render), L)
    return out, render


def queue():
    pans, render = panoramas()
    renders = []
    for path, L in pans.items():
        name = os.path.splitext(os.path.basename(path))[0]
        lit = {} if eq.station_moment(render, L["station"], L["era"]) is None else {"moment": L["moment"]}
        renders.append({"state": L["era"], "station": L["station"], **lit, "out": f"build/render/pano/{name}.png",
                        "mask": f"build/render/sky-mask/{name}.png", "for": L["id"]})
    path = os.path.join(ROOT, "build", "jobs", "q-sky-masks.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"about": "the open sky of each panorama with a live sky (render/sky_masks.py)", "renders": renders}, f, indent=1)
    print(f"{len(renders)} masks into {path}")


def write():
    from PIL import Image
    os.makedirs(OUT, exist_ok=True)
    pans, _ = panoramas()
    for path in pans:
        name = os.path.splitext(os.path.basename(path))[0]
        src = os.path.join(RENDERS, name + ".png")
        if not os.path.exists(src):
            print(f"no render for {name}: run the queue first")
            continue
        a = Image.open(src).convert("RGBA").getchannel("A").point(lambda v: 255 if v >= 128 else 0)
        mask = Image.new("RGBA", a.size, (0, 0, 0, 0))
        mask.putalpha(a)
        mask.save(os.path.join(OUT, name + ".png"), optimize=True)
        open_share = sum(1 for v in a.get_flattened_data() if v == 0) / (a.size[0] * a.size[1])
        print(f"{name}: {open_share:.0%} open sky")


if __name__ == "__main__":
    {"queue": queue, "write": write}[sys.argv[1]]()
