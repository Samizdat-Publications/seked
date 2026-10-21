"""
Read Enclosure D's pillars off Haklay & Gopher 2020, Fig. 1, into records.

    pdfimages -f 2 -l 2 -png <the paper's PDF> /tmp/fig1        # the figure at its own resolution
    python scripts/enclosure_d_plan.py /tmp/fig1-000.png         # print the records
    python scripts/enclosure_d_plan.py /tmp/fig1-000.png --write # put them in data/measurements/gobekli.json

The paper is CC BY-NC-ND 4.0 and its figure stays out of the repository
(night list, decision 70); this reads it where it lies. The figure is the main
excavation area's schematic plan, embedded at 485 by 672 px, 150 ppi, north up,
with a 5 m scale bar at x 356 to 405, y 70.5 (`python scripts/plate.py scale
--bar 355.5 70.5 405.5 70.5 5`: 0.1 m a pixel). The pillars are drawn as
near-black bars and the walls in greys, so the pillars are found by their fill,
not by eye: every 8-connected run of pixels darker than 22 (of 255) inside
Enclosure D's box. Thirteen bars stand on the ring, two central and eleven in
the wall, which is the count the paper prints on p. 347; the letter D and a
mark on Enclosure C's wall are left out by their place.

Each bar's centre is the mean of its pixels; its long axis the principal axis
of their spread, and its length the extent a uniform bar of that spread has
(sqrt(12 var)). Positions are east and north of the midpoint of the two central
pillars' centres. The sigma is `plate.py measure`'s three terms: 1.5 px at each
end through the scale (0.21 m), the drafting tolerance of half a millimetre on
the printed figure (82 mm across for 48.5 m, so 0.30 m), and no shrinkage, the
figure's own bar being the only scale on it. The ring's inner width east to
west, about 138 px, is 13.8 m against the printed "about 14 m". Never verified.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "measurements", "gobekli.json")
MPP = 0.1                    # metres per pixel, from the 5 m bar's 50 px
PX_SIGMA = 1.5               # px, at each end
DRAFTING_M = 0.30            # half a millimetre on the printed figure
BOX = (100, 270, 275, 400)   # x0, y0, x1, y1: Enclosure D and its wall, not C's
DARK = 22
LETTER_D = (187.5, 341.5)    # the label's pixels pass the threshold; it is not a pillar


def bars(path):
    g = np.asarray(Image.open(path).convert("L")).astype(int)
    x0, y0, x1, y1 = BOX
    mask = g[y0:y1, x0:x1] < DARK
    seen = np.zeros(mask.shape, bool)
    out = []
    for yy, xx in zip(*np.nonzero(mask)):
        if seen[yy, xx]:
            continue
        seen[yy, xx] = True
        stack, pts = [(yy, xx)], []
        while stack:
            a, b = stack.pop()
            pts.append((a, b))
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    c, d = a + da, b + db
                    if 0 <= c < mask.shape[0] and 0 <= d < mask.shape[1] and mask[c, d] and not seen[c, d]:
                        seen[c, d] = True
                        stack.append((c, d))
        if len(pts) < 8:
            continue
        p = np.array(pts, float)
        xs, ys = p[:, 1] + x0 + 0.5, p[:, 0] + y0 + 0.5
        if math.hypot(xs.mean() - LETTER_D[0], ys.mean() - LETTER_D[1]) < 3:
            continue
        w, v = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
        ax = v[:, 1]
        out.append({
            "px": float(xs.mean()), "py": float(ys.mean()), "n": len(pts),
            "long_px": float(math.sqrt(12 * w[1])),
            # the long axis as a bearing, degrees clockwise from north, image y running south
            "axis": float(math.degrees(math.atan2(ax[0], -ax[1])) % 180),
        })
    return out


def records(found):
    if len(found) != 13:
        sys.exit(f"{len(found)} bars found in Enclosure D's box, not 13: has the figure or the box changed?")
    central = sorted(sorted(found, key=lambda b: -b["long_px"])[:2], key=lambda b: b["px"])
    ring = [b for b in found if b not in central]
    cx = (central[0]["px"] + central[1]["px"]) / 2
    cy = (central[0]["py"] + central[1]["py"]) / 2
    az = lambda b: math.degrees(math.atan2(b["px"] - cx, -(b["py"] - cy))) % 360
    ring.sort(key=az)
    pos_sigma = round(math.hypot(PX_SIGMA, PX_SIGMA) * MPP + DRAFTING_M, 2)
    where = (f"Scaled with scripts/enclosure_d_plan.py off Haklay & Gopher 2020, Fig. 1 (p. 344), against its 5 m bar, "
             f"{MPP} m a pixel, north up; east and north of the midpoint of the two central pillars' centres, at pixel "
             f"({cx:.1f}, {cy:.1f}). Sigma: 1.5 px at each end ({math.hypot(PX_SIGMA, PX_SIGMA) * MPP:.2f} m) and the drafting "
             f"tolerance ({DRAFTING_M:.2f} m), the figure being schematic.")
    out = []

    def add(key, quantity, value, unit, sigma, note):
        out.append({"key": f"gobekli.enclosure_d.{key}", "structure": "gobekli.enclosure-d", "quantity": quantity,
                    "value": value, "unit": unit, "sigma": sigma, "source": "haklay-gopher-2020",
                    "method": "scaled from plate", "note": note, "verified": False, "site": "gobekli-tepe"})

    named = [("central_west", central[0], "The western central pillar"), ("central_east", central[1], "The eastern central pillar")]
    named += [(f"ring_{i + 1:02d}", b, f"Wall pillar {i + 1} of 11, counted clockwise from north about the centre "
               f"({az(b):.0f}°)") for i, b in enumerate(ring)]
    for name, b, what in named:
        at = f"{what}: its bar's centre at pixel ({b['px']:.1f}, {b['py']:.1f}), {b['n']} px. "
        add(f"pillar.{name}.east", "length", round((b["px"] - cx) * MPP, 2), "m", pos_sigma, at + where)
        add(f"pillar.{name}.north", "length", round(-(b["py"] - cy) * MPP, 2), "m", pos_sigma, at + where)
        length = b["long_px"] * MPP
        add(f"pillar.{name}.plan_length", "length", round(length, 2), "m", pos_sigma,
            at + "The bar's length along its long axis, sqrt(12 var) of its pixels: the pillar's width as the "
            "schematic plan draws it, not its thickness. " + where)
        if name.startswith("central"):
            # an axis known to a pixel and a half at each end and the drafting, over the bar's length
            sig = round(math.degrees(math.atan2(2 * (math.hypot(PX_SIGMA, PX_SIGMA) * MPP / 2 + DRAFTING_M / 2), length)), 0)
            add(f"pillar.{name}.axis_bearing", "angle", round(b["axis"], 0), "deg", sig,
                at + "The bar's long axis, degrees clockwise from north, the line the pillar's broad faces run along. " + where)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("figure", help="Fig. 1 at its own resolution, as pdfimages writes it")
    ap.add_argument("--write", action="store_true", help="replace the scaled records in data/measurements/gobekli.json")
    args = ap.parse_args(argv)
    recs = records(bars(args.figure))
    if not args.write:
        print(json.dumps(recs, indent=2, ensure_ascii=False))
        return
    with open(OUT, encoding="utf-8") as f:
        kept = [r for r in json.load(f) if r.get("method") != "scaled from plate"]
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(json.dumps(kept + recs, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(recs)} scaled records written to {OUT}")


if __name__ == "__main__":
    main()
