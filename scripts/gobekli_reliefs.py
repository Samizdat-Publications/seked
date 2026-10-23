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


def heights(v, stone):
    stroke = (v < STROKE) & stone
    raise_ = np.clip((v - 0.5) / 0.5, 0.0, 1.0)
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
        v = v[y0:y1, x0:x1]
        stone = margins(v) if spec.get("margins") == "white" else np.ones(v.shape, dtype=bool)
        h = heights(v, stone)[::2, ::2]
        Image.fromarray((np.clip(h, 0, 1) * 65535).astype(np.uint16)).save(os.path.join(OUT, name + ".png"))
        report[name] = dict(spec, shape=list(h.shape), stroke=STROKE, bevel_px=BEVEL)
        print(name, h.shape)
    json.dump(dict(note="Look reconstruction from drawings and photographs (docs/gobekli-reliefs.md); not "
                        "measurements. crop is the stone in the source, in its pixels; step and shaft its outline as "
                        "drawn, read by eye.", reliefs=report),
              open(os.path.join(OUT, "reliefs.json"), "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
