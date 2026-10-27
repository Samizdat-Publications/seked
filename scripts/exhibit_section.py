"""
Chapter 9's section card: the Great Pyramid as an x-ray with its known rooms, the 2017 Big Void's zone and the 2023
north-face corridor (render/khufu_section.py), labelled, for the exhibit.

    python scripts/exhibit_section.py            # apps/exhibit/objects/khufu-section.jpg

The labels are drawn into the picture at the points the render projects (its JSON's labels_at_px), each with a short
leader, so they stay on what they name however the card is cropped round them. The figure that shows it is
`khufu-section` in apps/exhibit/src/figures.ts.
"""
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
OUT = os.path.join(ROOT, "apps", "exhibit", "objects", "khufu-section.jpg")
WORK = os.path.join(ROOT, "build", "preview", "khufu-section-card.png")
SIZE = "1920x1200"
MONO = r"C:\Windows\Fonts\consola.ttf"
GOLD, BLUE, BONE = (255, 196, 92), (150, 200, 255), (236, 228, 212)
# label: (text, colour, leader end offset from the point in px at 1920 wide, text anchor)
LABELS = {
    "corridor": ("north-face corridor, 2023", GOLD, (0, -250), "md"),
    "void": ("Big Void, 2017: its centre lies in this band", BLUE, (0, -90), "md"),
    "kings": ("King's Chamber", BONE, (150, -40), "lm"),
    "queens": ("Queen's Chamber", BONE, (170, 30), "lm"),
    "gallery": ("Grand Gallery", BONE, (-150, 10), "rm"),
    "entrance": ("entrance", BONE, (-60, 60), "rt"),
    "north": ("N", BONE, (0, 40), "mt"),
    "south": ("S", BONE, (0, 40), "mt"),
}


def main():
    subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "render", "khufu_section.py"), "--",
                    "--shot", "whole", "--size", SIZE, "--samples", "128", "--out", WORK], check=True, capture_output=True)
    with open(os.path.splitext(WORK)[0] + ".json", encoding="utf-8") as f:
        at = json.load(f)["placed"]["labels_at_px"]
    im = Image.open(WORK).convert("RGB")
    s = im.width / 1920
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(MONO, round(28 * s))
    for key, (text, colour, (dx, dy), anchor) in LABELS.items():
        x, y = at[key]
        ex, ey = x + dx * s, y + dy * s
        if key not in ("north", "south"):
            d.line([(x, y), (ex, ey)], fill=colour, width=max(2, round(2 * s)))
            d.ellipse([x - 5 * s, y - 5 * s, x + 5 * s, y + 5 * s], fill=colour)
        pad = 10 * s
        tx = ex + (pad if anchor[0] == "l" else -pad if anchor[0] == "r" else 0)
        ty = ey + (-pad if anchor[1] == "d" else pad if anchor[1] == "t" else 0)
        d.text((tx, ty), text, font=font, fill=colour, anchor=anchor, stroke_width=round(4 * s), stroke_fill=(14, 16, 22))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, quality=90, optimize=True)
    print(f"wrote {OUT} {im.size}")


if __name__ == "__main__":
    main()
