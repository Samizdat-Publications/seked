"""
The viewer's stone, from the render's texture sets.

    python scripts/web-textures.py

Reads build/textures/index.json, which scripts/textures.py writes, and writes
apps/web/public/textures/<role>.webp, each set's colour map at 1024 pixels,
and apps/web/public/textures/index.json with the tile size and attribution the
viewer needs. The viewer draws flat colour where these are missing, so this
exits quietly when the sets have not been fetched, as on a machine that only
runs the tests. The outputs are generated and gitignored.

Needs Pillow.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(ROOT, "build", "textures", "index.json")
OUT = os.path.join(ROOT, "apps", "web", "public", "textures")
SIZE = 1024


def main():
    if not os.path.exists(SOURCE):
        print(f"web-textures: no {SOURCE}; the viewer will draw flat colour (run python scripts/textures.py first)")
        return
    from PIL import Image

    index = json.load(open(SOURCE, encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for role, entry in index["sets"].items():
        src = os.path.join(os.path.dirname(SOURCE), entry["files"]["Diffuse"])
        name = f"{role}.webp"
        image = Image.open(src).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        image.save(os.path.join(OUT, name), "WEBP", quality=82, method=6)
        # The map's mean luminance once decoded to linear light, which is what the
        # shader divides by so the photograph adds variation and not a tone.
        small = image.resize((64, 64), Image.BOX)
        to_linear = lambda c: (c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        pixels = [tuple(to_linear(v / 255.0) for v in px) for px in small.getdata()]
        mean = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in pixels) / len(pixels)
        authors = ", ".join(entry.get("authors", {}).keys())
        manifest[role] = {"file": name, "tileMetres": entry["tile_m"][0], "meanLinear": round(mean, 4), "id": entry["id"], "url": entry["url"],
                          "license": entry["license"], "attribution": f"{entry['name']} by {authors}, Poly Haven, {entry['license']}"}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"web-textures: {len(manifest)} maps at {SIZE} px into {OUT}")


if __name__ == "__main__":
    sys.exit(main())
