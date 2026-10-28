"""
Chapter 7's Göbekli Tepe cards: the excavation today (the photogrammetry scan on its hill) and Enclosure D about
9500 BCE as built from its plan (render/gobekli.py), for the exhibit.

    python scripts/exhibit_gobekli.py      # apps/exhibit/objects/gobekli-today.jpg, -ring.jpg, -p43.jpg, -pair.jpg

Renders the views and writes them as JPEG where the exhibit serves its objects (`/objects/`, copied by `pnpm site`).
The figures that show them are `gobekli-today`, `gobekli-ring`, `gobekli-p43` and `gobekli-pair` in
apps/exhibit/src/figures.ts.
"""
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
OUT = os.path.join(ROOT, "apps", "exhibit", "objects")
WORK = os.path.join(ROOT, "build", "gobekli", "exhibit")
# card: (era, view)
SHOTS = {"gobekli-today": ("today", "air"), "gobekli-scan": ("today", "pair"), "gobekli-ring": ("9500", "rim"), "gobekli-p43": ("9500", "p43"),
         "gobekli-pair": ("9500", "inside")}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    for era in sorted({e for e, _ in SHOTS.values()}):
        views = [v for e, v in SHOTS.values() if e == era]
        subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "render", "gobekli.py"), "--",
                        "--era", era, "--view", ",".join(views), "--size", "1280x720", "--samples", "128",
                        "--out", WORK], check=True, capture_output=True)
    for name, (era, view) in SHOTS.items():
        im = Image.open(os.path.join(WORK, f"gobekli-{era}-{view}.png")).convert("RGB")
        im.save(os.path.join(OUT, name + ".jpg"), quality=88)
        print("wrote", name, im.size)


if __name__ == "__main__":
    sys.exit(main())
