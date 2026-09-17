"""
The viewer's stone and its Milky Way, from the render's own source images.

    python scripts/web-textures.py

Reads build/textures/index.json, which scripts/textures.py writes, and writes
for each role three maps into apps/web/public/textures/: <role>.webp, the
colour map; <role>-normal.webp, the OpenGL-convention normal map; and
<role>-rough.webp, the roughness, as a single channel carried in a grey
image. apps/web/public/textures/index.json carries the tile size, the mean
luminance the shader divides the photograph by, and the attribution the
licence requires.

Also reads build/sky/milkyway_2020_8k.exr, NASA's Deep Star Maps 2020 (SVS
4851, public domain), and writes apps/web/public/sky/milkyway-2k.webp: the
same equirectangular map on J2000 axes that blender/render_sky.py puts behind
the night renders, at a size a browser can hold. The EXR is high dynamic
range and Pillow cannot read one, so Blender does that step: it is already
this project's image tool and it is where the render reads the same file.

The outputs are generated and gitignored. The viewer draws flat colour and no
Milky Way where they are missing, so this exits quietly when the sources have
not been fetched, as on a machine that only runs the tests.

Needs Pillow; needs Blender for the Milky Way.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(ROOT, "build", "textures", "index.json")
OUT = os.path.join(ROOT, "apps", "web", "public", "textures")
SIZE = 1024

# The relief maps are worth more pixels than the colour: a normal map read at
# a grazing angle is what makes a course look like a block rather than a
# painted line, and it is the one map the eye can see interpolated.
RELIEF_SIZE = 2048

SKY_SOURCE = os.path.join(ROOT, "build", "sky", "milkyway_2020_8k.exr")
SKY_OUT = os.path.join(ROOT, "apps", "web", "public", "sky")
SKY_SIZE = (2048, 1024)

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe")


def to_linear(c):
    """One sRGB channel in 0 to 1 decoded to linear light."""
    return (c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mean_linear(image):
    """The map's mean luminance once decoded to linear light, which is what the
    shader divides by so the photograph adds variation and not a tone."""
    small = image.resize((64, 64), 1)  # Image.LANCZOS is 1 in every Pillow
    pixels = list(small.convert("RGB").getdata())
    total = sum(0.2126 * to_linear(r / 255.0) + 0.7152 * to_linear(g / 255.0) + 0.0722 * to_linear(b / 255.0)
                for r, g, b in pixels)
    return total / len(pixels)


def write_map(Image, src, path, size, grey=False):
    """One of a set's maps at `size`, as WebP. Returns the opened image."""
    image = Image.open(src).convert("L" if grey else "RGB").resize((size, size), Image.LANCZOS)
    image.save(path, "WEBP", quality=88 if grey else 82, method=6)
    return image


def stone():
    if not os.path.exists(SOURCE):
        print(f"web-textures: no {SOURCE}; the viewer will draw flat colour (run python scripts/textures.py first)")
        return
    from PIL import Image

    index = json.load(open(SOURCE, encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for role, entry in index["sets"].items():
        folder = os.path.dirname(SOURCE)
        files = entry["files"]
        colour = write_map(Image, os.path.join(folder, files["Diffuse"]), os.path.join(OUT, f"{role}.webp"), SIZE)
        maps = {"colour": f"{role}.webp"}
        # Poly Haven's nor_gl is the OpenGL convention, green up, which is the
        # one three's tangent-space normals want. A set fetched before
        # blender/textures.json named it simply has no relief and says so.
        if "nor_gl" in files:
            write_map(Image, os.path.join(folder, files["nor_gl"]), os.path.join(OUT, f"{role}-normal.webp"), RELIEF_SIZE)
            maps["normal"] = f"{role}-normal.webp"
        if "Rough" in files:
            write_map(Image, os.path.join(folder, files["Rough"]), os.path.join(OUT, f"{role}-rough.webp"), RELIEF_SIZE, grey=True)
            maps["roughness"] = f"{role}-rough.webp"
        authors = ", ".join(entry.get("authors", {}).keys())
        manifest[role] = {"file": maps["colour"], "maps": maps, "tileMetres": entry["tile_m"][0],
                          "meanLinear": round(mean_linear(colour), 4), "id": entry["id"], "url": entry["url"],
                          "license": entry["license"],
                          "attribution": f"{entry['name']} by {authors}, Poly Haven, {entry['license']}"}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"web-textures: {len(manifest)} sets, {sum(len(m['maps']) for m in manifest.values())} maps, into {OUT}")


# Run inside Blender, which is the only reader of OpenEXR this project has.
# The map is normalised against a high percentile rather than its maximum,
# because a handful of pixels on the galactic centre are hundreds of times
# the median and would otherwise take the whole range; what is left over is
# clipped, which is what a photograph of the sky does too. The scale is a look
# choice and the file it writes is a picture, never a measurement.
MILKY_WAY_SCRIPT = r'''
import sys, bpy, numpy as np
src, dst, width, height = sys.argv[-4], sys.argv[-3], int(sys.argv[-2]), int(sys.argv[-1])
image = bpy.data.images.load(src)
image.scale(width, height)
buffer = np.empty(len(image.pixels), dtype=np.float32)
image.pixels.foreach_get(buffer)
rgb = buffer.reshape(height, width, 4)[:, :, :3]
top = float(np.percentile(rgb, 99.95))
rgb = np.clip(rgb / max(top, 1e-9), 0.0, 1.0)
out = bpy.data.images.new("milkyway", width, height, alpha=False, float_buffer=False)
out.colorspace_settings.name = "sRGB"
flat = np.concatenate([rgb, np.ones((height, width, 1), dtype=np.float32)], axis=2).ravel()
out.pixels.foreach_set(flat)
out.file_format = "PNG"
out.save(filepath=dst)
print(f"milky way: {width} by {height}, normalised against the 99.95th percentile {top:.6g}")
'''


def milky_way():
    if not os.path.exists(SKY_SOURCE):
        print(f"web-textures: no {SKY_SOURCE}; the viewer's night sky will have no Milky Way "
              "(fetch milkyway_2020_8k.exr from https://svs.gsfc.nasa.gov/4851, see data/sources.json, nasa-svs-4851)")
        return
    if not os.path.exists(BLENDER):
        print(f"web-textures: no Blender at {BLENDER}; the Milky Way needs it to read the EXR (set BLENDER to override)")
        return
    from PIL import Image

    os.makedirs(SKY_OUT, exist_ok=True)
    script = os.path.join(ROOT, "build", "sky", "milkyway.py")
    png = os.path.join(ROOT, "build", "sky", "milkyway-2k.png")
    with open(script, "w", encoding="utf-8") as f:
        f.write(MILKY_WAY_SCRIPT)
    done = subprocess.run([BLENDER, "--background", "--factory-startup", "--python", script, "--",
                           SKY_SOURCE, png, str(SKY_SIZE[0]), str(SKY_SIZE[1])],
                          capture_output=True, text=True)
    if done.returncode != 0 or not os.path.exists(png):
        print(f"web-textures: Blender could not read the EXR\n{done.stdout[-2000:]}\n{done.stderr[-2000:]}")
        return
    for line in done.stdout.splitlines():
        if line.startswith("milky way:"):
            print(f"web-textures: {line}")
    out = os.path.join(SKY_OUT, "milkyway-2k.webp")
    Image.open(png).convert("RGB").save(out, "WEBP", quality=88, method=6)
    os.remove(png)
    print(f"web-textures: {os.path.getsize(out) / 1e6:.1f} MB into {out}")


def main():
    stone()
    milky_way()


if __name__ == "__main__":
    sys.exit(main())
