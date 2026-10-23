"""
Chapter 8's Labyrinth cards: the Labyrinth at Hawara as one reconstruction draws it (render/hawara_labyrinth.py), for
the exhibit.

    python scripts/exhibit_labyrinth.py          # apps/exhibit/objects/hawara-labyrinth.jpg and hawara-labyrinth-under.jpg

Renders the aerial view and the pit that shows the legendary lower storey, and writes them as JPEG where the exhibit
serves its objects (`/objects/`, copied by `pnpm site`). The figures that show them are `hawara-labyrinth` and
`hawara-lower` in apps/exhibit/src/figures.ts.
"""
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
OUT = os.path.join(ROOT, "apps", "exhibit", "objects")
WORK = os.path.join(ROOT, "build", "hawara", "exhibit")
SHOTS = {"hawara-labyrinth": "air", "hawara-labyrinth-under": "under"}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WORK, exist_ok=True)
    subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "render", "hawara_labyrinth.py"), "--",
                    "--view", ",".join(SHOTS.values()), "--size", "1280x720", "--samples", "128", "--out", WORK],
                   check=True, capture_output=True)
    for name, view in SHOTS.items():
        im = Image.open(os.path.join(WORK, f"labyrinth-{view}.png")).convert("RGB")
        im.save(os.path.join(OUT, name + ".jpg"), quality=88)
        print("wrote", name, im.size)


if __name__ == "__main__":
    sys.exit(main())
