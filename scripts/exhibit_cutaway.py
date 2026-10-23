"""
Chapter 8's card: the Khafre Project's claimed wells, sawn open (render/underground.py --style solid), for the exhibit.

    python scripts/exhibit_cutaway.py            # apps/exhibit/objects/khafre-cutaway.jpg and khafre-cutaway-top.jpg

Renders the whole sawn block (shot `card`) and the wells' tops under Khafre (shot `top`), crops each to what it
shows against the dark backdrop with a small margin, and writes them as JPEG where the exhibit serves its objects
(`/objects/`, copied by `pnpm site`). The figure that shows them is `khafre-cutaway` in apps/exhibit/src/figures.ts.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
OUT = os.path.join(ROOT, "apps", "exhibit", "objects")
WORK = os.path.join(ROOT, "build", "preview")
SHOTS = {"khafre-cutaway": ("card", "900x1100"), "khafre-cutaway-top": ("top", "900x620")}


def crop(im, margin=24):
    """The picture cut to what is not the dark backdrop, plus a margin."""
    a = np.asarray(im, dtype=float).mean(axis=2)
    rows, cols = np.where((a > 45).any(axis=1))[0], np.where((a > 45).any(axis=0))[0]
    y0, y1 = max(rows[0] - margin, 0), min(rows[-1] + margin, im.height)
    x0, x1 = max(cols[0] - margin, 0), min(cols[-1] + margin, im.width)
    return im.crop((x0, y0, x1, y1))


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    for name, (shot, size) in SHOTS.items():
        png = os.path.join(WORK, name + ".png")
        subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "render", "underground.py"), "--",
                        "--shot", shot, "--style", "solid", "--size", size, "--samples", "128", "--out", png],
                       check=True, capture_output=True)
        im = Image.open(png).convert("RGB")
        im = crop(im) if shot == "card" else im
        im.save(os.path.join(OUT, name + ".jpg"), quality=88)
        print("wrote", name, im.size)


if __name__ == "__main__":
    sys.exit(main())
