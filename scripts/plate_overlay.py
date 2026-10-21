"""
Draw the surveyed section over a registered plate, so a viewer can see how the plate lies against the survey.

    python scripts/plate_overlay.py biondi-malanga-2022-fig24 [--out build/preview/fig24-registered.png]

The plate's registration is in assets/plates/manifest.json ("registered": the pixel origin of the frame's
axis and base line, metres per pixel from the plate's own scale bar, and which pixel direction is north and
up). The overlay draws the Great Pyramid's outline from g1.base.side.mean and g1.height.original (Lehner
first, as the canonical preset) and every interior point Petrie gives as a north/up pair in g1-interior.json.
Nothing is read off the plate by eye: the transform is the scale bar's, and the two points it is pinned to
are read on a pixel grid (scripts/plate.py grid).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def value(records, key, prefer=("lehner-1997", "petrie-1883")):
    found = [r for r in records if r["key"] == key]
    rank = {s: i for i, s in enumerate(prefer)}
    return float(min(found, key=lambda r: rank.get(r["source"], len(rank)))["value"])


def main(argv):
    pid = argv[1]
    out = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(REPO, "build", "preview", pid + "-registered.png")
    manifest = json.load(open(os.path.join(REPO, "assets", "plates", "manifest.json"), encoding="utf-8"))
    plate = next(p for p in manifest["plates"] if p["id"] == pid)
    reg = plate["registered"]
    ox, oy = reg["origin_px"]
    mpp = reg["m_per_px"]
    sn, su = reg["north_px"], reg["up_px"]          # +1 or -1: which way north and up run in pixels

    def px(north, up):
        return (ox + sn * north / mpp, oy - su * up / mpp)

    g1 = json.load(open(os.path.join(REPO, "data", "measurements", "g1.json"), encoding="utf-8"))
    half, H = value(g1, "g1.base.side.mean") / 2, value(g1, "g1.height.original")
    inner = json.load(open(os.path.join(REPO, "data", "measurements", "g1-interior.json"), encoding="utf-8"))
    pts = {}
    for r in inner:
        for axis in ("north", "up"):
            if r["key"].endswith("." + axis):
                pts.setdefault(r["key"][: -len(axis) - 1], {})[axis] = float(r["value"])
    im = Image.open(os.path.join(REPO, "assets", "plates", plate["file"])).convert("RGB")
    d = ImageDraw.Draw(im)
    d.line([px(-half, 0), px(0, H), px(half, 0), px(-half, 0)], fill=(255, 255, 255), width=5)
    n = 0
    for p in pts.values():
        if "north" in p and "up" in p:
            x, y = px(p["north"], p["up"])
            d.ellipse([x - 7, y - 7, x + 7, y + 7], outline=(255, 255, 255), width=3)
            n += 1
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    print(json.dumps({"out": out, "points": n, "outline": {"half": half, "height": H}}))


if __name__ == "__main__":
    main(sys.argv)
