"""Tile a lab_sheet.py folder into its two sheets: python scripts/sphinx_lab/tile.py DIR

DIR/sheet-material.jpg and DIR/sheet-clay.jpg, each the seven views in a 3 + 4 grid with their names."""
import os
import sys

from PIL import Image, ImageDraw

VIEWS = ["front", "south", "north", "front34", "head", "back", "beds"]


def tile(d, kind, cell=(768, 480)):
    ims = [(v, os.path.join(d, f"{kind}-{v}.png")) for v in VIEWS]
    ims = [(v, Image.open(p).convert("RGB").resize(cell)) for v, p in ims if os.path.exists(p)]
    if not ims:
        return None
    cols = 4
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cell[0] * cols, cell[1] * rows), (20, 20, 20))
    draw = ImageDraw.Draw(sheet)
    for i, (v, im) in enumerate(ims):
        x, y = (i % cols) * cell[0], (i // cols) * cell[1]
        sheet.paste(im, (x, y))
        draw.rectangle((x, y, x + 110, y + 22), fill=(0, 0, 0))
        draw.text((x + 6, y + 5), v, fill=(255, 255, 255))
    path = os.path.join(d, f"sheet-{kind}.jpg")
    sheet.save(path, quality=90)
    return path


if __name__ == "__main__":
    for kind in ("material", "clay"):
        print(tile(sys.argv[1], kind))
