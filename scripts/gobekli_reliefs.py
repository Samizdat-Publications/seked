"""
Clean the Göbekli Tepe relief height maps (docs/gobekli-reliefs.md) into what render/gobekli.py carves.

    python scripts/gobekli_reliefs.py          # assets/gobekli-reliefs/cleaned/<name>.png and reliefs.json

Each source in SOURCES is a height map drawn from the excavators' drawing and photographs: mid grey the stone's
original surface, white the raised motif, and the drawing's own strokes still in it. Here:

1. it is cut to the stone: a crop box read off the source by hand (a look choice, in SOURCES), and for a face drawn
   with white margins round it, the margins' straight edges fitted row by row and everything outside them dropped;
2. the drawing's dark strokes are taken out: each stroke pixel takes the height of the nearest pixel that is not a
   stroke, less half its raise, so an outline round a motif becomes its edge and a stroke inside one (the hatching
   on Pillar 43's bags and bands) a shallow incised line;
3. a small blur gives the cut edges their bevel.

The heights go out as 16-bit grey PNGs (0 the stone's surface, 65535 the full raise) at half the source's
resolution, ready as displacement maps in any 3D package, and the crops and the stones' proportions read by hand
(their broad top's share of the height, their shaft's span across the width) into reliefs.json, which the stand-in
uses for that pillar. All of it is a look reconstruction: nothing enters data/.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.join(ROOT, "assets", "gobekli-reliefs")      # see its README.md
SRC = os.path.join(HOME, "source")
OUT = os.path.join(HOME, "cleaned")
# name: source, crop box in source pixels (x0, y0, x1, y1), and what the drawing shows of the stone's shape: `step`
# the share of the height down to where its broad top ends, `shaft` its shaft's span across the width (0 to 1, from
# the crop's left), `margins` "white" where the face is drawn inside white margins. Read off the sources by eye.
# Pillar 20's map gives the flat face of the shaft this grey, not the usual mid grey (read off it: its commonest value)
SURFACE_P20 = 0.62
SOURCES = {
    # the Vulture Stone's broad face: the step down to the shaft on the right at 61 per cent, the shaft below it
    # spanning the left 77 per cent (its lower left corner is the excavators' dashed, unexcavated part)
    "p43-front": dict(src="p43-front.png", crop=(88, 150, 1375, 2360), step=0.61, shaft=(0.0, 0.77)),
    # Pillar 18's west broad face below its head: the arm from the elbow to the hands at the front (right), the fox,
    # the belt and the pelt's start; the drawing's two edge lines are the shaft's edges
    "p18-side": dict(src="p18-side.png", crop=(405, 120, 1140, 2640)),
    # its narrow front (south) below the head, drawn inside white margins: the signs, the stola, the hands, the belt
    # with its buckle and the hanging pelt
    "p18-front": dict(src="p18-front.png", crop=(0, 0, 1536, 2752), margins="white"),
    # Pillar 31's broad side: the same arm and belt as Pillar 18's in the photographs of its full-size replica in the
    # Sanliurfa museum (Wikimedia Commons, CC BY-SA 4.0), but no fox, so it is Pillar 18's map with the fox erased
    "p31-side": dict(src="p18-side.png", crop=(405, 120, 1140, 2640), erase=[(522, 860, 1030, 1090)]),
    # its narrow front from a photograph of the replica: the stola's two bands, the hands, the belt's U buckle, the
    # hanging pelt (the bucranium on its neck lies above the photograph's frame and is not drawn)
    "p31-front": dict(src="p31-front.png", crop=(520, 0, 1010, 2752)),
    # Pillar 33's carved broad face from the excavators' numbered drawing: snakes, cranes, a fox and other animals,
    # the head running down 40 per cent of the height, the shaft spanning 20 to 74 per cent of the width
    "p33-broad": dict(src="p33-broad.png", crop=(115, 100, 1690, 2330), step=0.40, shaft=(0.20, 0.74)),
    # Pillar 27 (Enclosure C): the predator carved almost in the round, head down, and the boar in low relief below,
    # as a depth map of a photograph (Commons, CC BY-SA 4.0) rather than a redrawing, which tidied both into
    # naturalistic animals; its tilted face is fitted and taken off. Its greatest raise is about 25 cm, not 4
    "p27-broad": dict(src="p27-broad-depth.png", crop=(250, 0, 1180, 2450), mode="depth", raise_m=0.25),
    # Pillar 20's narrow front, between the wall's stretches: the aurochs and the snake running down beside it, as a
    # depth map of the DAI's photograph (N. Becker, DAI, via the Tepe Telegrams in the Wayback Machine), padded to the
    # image model's frame; the crop is the shaft below the head block, to the photograph's foot
    "p20-front": dict(src="p20-front-depth.png", crop=(330, 570, 1040, 2752), surface=SURFACE_P20),
}
STROKE = 0.30        # darker than this is a drawn stroke, not the stone
BEVEL = 1.6          # px: the blur that rounds the cut edges


def margins(v):
    """The face inside white margins: each row's first and last non-white pixel, fitted by straight lines (robustly,
    from the middle half of the rows, where no motif touches the margin)."""
    ys, lo, hi = [], [], []
    for y in range(v.shape[0] // 4, 3 * v.shape[0] // 4):
        g = np.where(v[y] < 0.93)[0]
        if len(g):
            ys.append(y); lo.append(g[0]); hi.append(g[-1])
    fl, fh = np.polyfit(ys, lo, 1), np.polyfit(ys, hi, 1)
    Y, X = np.mgrid[0:v.shape[0], 0:v.shape[1]]
    return (X >= np.polyval(fl, Y) + 4) & (X <= np.polyval(fh, Y) - 4)


def depth(v):
    """A depth map of a photograph as heights above the carved face: a plane fitted to the face (iteratively, leaving
    out what stands proud of it) is taken off, and the rest scaled so the highest point is 1."""
    Y, X = np.mgrid[0:v.shape[0], 0:v.shape[1]]
    A = np.c_[X.ravel(), Y.ravel(), np.ones(v.size)]
    keep = np.ones(v.size, dtype=bool)
    for _ in range(6):
        c, *_ = np.linalg.lstsq(A[keep], v.ravel()[keep], rcond=None)
        r = v.ravel() - A @ c
        keep = r < np.percentile(r[keep], 70)
    h = np.clip((v - (A @ c).reshape(v.shape)) - np.percentile(r[keep], 50), 0, None)
    return nd.gaussian_filter(h / np.percentile(h, 99.7), 1.0)


def heights(v, stone, surface=0.5):
    stroke = (v < STROKE) & stone
    raise_ = np.clip((v - surface) / (1.0 - surface), 0.0, 1.0)
    # every stroke pixel takes its nearest clean neighbour's raise, then is cut half of it down
    _, (iy, ix) = nd.distance_transform_edt(stroke, return_indices=True)
    near = raise_[iy, ix]
    h = np.where(stroke, 0.5 * near, raise_)
    h = nd.gaussian_filter(h, BEVEL)
    return np.where(stone, h, 0.0)


def main():
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for name, spec in SOURCES.items():
        v = np.asarray(Image.open(os.path.join(SRC, spec["src"])).convert("L"), dtype=float) / 255.0
        x0, y0, x1, y1 = spec["crop"]
        for ex0, ey0, ex1, ey1 in spec.get("erase", []):
            ring = np.r_[v[ey0 - 20:ey0, ex0:ex1].ravel(), v[ey1:ey1 + 20, ex0:ex1].ravel()]
            v[ey0:ey1, ex0:ex1] = np.median(ring)   # back to the stone's surface round it
        v = v[y0:y1, x0:x1]
        stone = margins(v) if spec.get("margins") == "white" else np.ones(v.shape, dtype=bool)
        h = (depth(v) if spec.get("mode") == "depth" else heights(v, stone, spec.get("surface", 0.5)))[::2, ::2]
        Image.fromarray((np.clip(h, 0, 1) * 65535).astype(np.uint16)).save(os.path.join(OUT, name + ".png"))
        report[name] = dict(spec, shape=list(h.shape), stroke=STROKE, bevel_px=BEVEL)
        print(name, h.shape)
    json.dump(dict(note="Look reconstruction from drawings and photographs (docs/gobekli-reliefs.md); not "
                        "measurements. crop is the stone in the source, in its pixels; step and shaft its outline as "
                        "drawn, read by eye.", reliefs=report),
              open(os.path.join(OUT, "reliefs.json"), "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
