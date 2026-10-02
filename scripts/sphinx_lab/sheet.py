"""Tile a views folder into one sheet: python scripts/sphinx_lab/sheet.py DIR [OUT]"""
import sys, os
from PIL import Image
d = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, "sheet.jpg")
fs = ["side", "front", "back", "front34", "back34"]
ims = [Image.open(os.path.join(d, f + ".png")).convert("RGB").resize((768, 512)) for f in fs if os.path.exists(os.path.join(d, f + ".png"))]
s = Image.new("RGB", (768 * 3, 512 * 2), (0, 0, 0))
for i, im in enumerate(ims):
    s.paste(im, ((i % 3) * 768, (i // 3) * 512))
s.save(out, quality=88)
