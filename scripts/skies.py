"""
Fetch the photographed skies.

    python scripts/skies.py

Reads blender/skies.json, asks the Poly Haven API for each sky's files and
information, downloads the HDRI at the named resolution and format into
build/skies/, checks it against the md5 the API publishes, and writes
build/skies/index.json: for each sky its file, its name, its authors and its
licence. A file already on disk with the right md5 is not downloaded again.
Where the sun stands in each image is found when the render loads it
(render/giza/sky.py), not here.

Standard library only, like scripts/textures.py, whose fetch and md5 it reuses.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from textures import API, ROOT, fetch, md5_of  # noqa: E402

MANIFEST = os.path.join(ROOT, "blender", "skies.json")
OUT = os.path.join(ROOT, "build", "skies")


def main():
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    res, fmt = manifest["resolution"], manifest["format"]
    os.makedirs(OUT, exist_ok=True)
    index = {"resolution": res, "skies": {}}
    for entry in manifest["skies"]:
        sky = entry["id"]
        info = json.loads(fetch(f"{API}/info/{sky}"))
        spec = json.loads(fetch(f"{API}/files/{sky}"))["hdri"][res][fmt]
        path = os.path.join(OUT, os.path.basename(spec["url"]))
        if not (os.path.exists(path) and md5_of(path) == spec["md5"]):
            print(f"{sky}: downloading {spec['size'] / 1e6:.0f} MB")
            with open(path, "wb") as f:
                f.write(fetch(spec["url"]))
            if md5_of(path) != spec["md5"]:
                sys.exit(f"{sky}: md5 mismatch after download")
        index["skies"][sky] = {"file": os.path.basename(path), "name": info["name"], "authors": info["authors"],
                               "license": "CC0", "url": f"https://polyhaven.com/a/{sky}", "why": entry["why"]}
        print(f"{sky}: ok")
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1)


if __name__ == "__main__":
    main()
