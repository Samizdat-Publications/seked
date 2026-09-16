"""
Fetch the render's texture sets.

    python scripts/textures.py

Reads blender/textures.json, asks the Poly Haven API for each set's files and
information, downloads the named maps at the named resolution into
build/textures/<id>/, checks every file against the md5 the API publishes, and
writes build/textures/index.json: for each set its role, its files, its
real-world tile size in metres (the API's `dimensions`, in millimetres), its
authors and its licence. A file already on disk with the right md5 is not
downloaded again.

Standard library only, so it runs anywhere Python does. Poly Haven asks API
users to send a User-Agent that names the project; this one does.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, "blender", "textures.json")
OUT = os.path.join(ROOT, "build", "textures")
API = "https://api.polyhaven.com"
AGENT = "seked/0.1 (personal research project; https://seked.pages.dev)"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    resolution, maps = manifest["resolution"], manifest["maps"]
    index = {"resolution": resolution, "sets": {}}
    for entry in manifest["sets"]:
        asset = entry["id"]
        info = json.loads(fetch(f"{API}/info/{asset}"))
        files = json.loads(fetch(f"{API}/files/{asset}"))
        folder = os.path.join(OUT, asset)
        os.makedirs(folder, exist_ok=True)
        written = {}
        for kind in maps:
            spec = files.get(kind, {}).get(resolution, {}).get("jpg")
            if spec is None:
                sys.exit(f"{asset}: Poly Haven has no {kind} map at {resolution} as jpg")
            path = os.path.join(folder, os.path.basename(spec["url"]))
            if not (os.path.exists(path) and md5_of(path) == spec["md5"]):
                data = fetch(spec["url"])
                if hashlib.md5(data).hexdigest() != spec["md5"]:
                    sys.exit(f"{asset}: {kind} does not match the md5 the API publishes")
                with open(path, "wb") as f:
                    f.write(data)
                print(f"{asset}: {kind} {len(data) / 1e6:.1f} MB")
            written[kind] = os.path.relpath(path, OUT).replace(os.sep, "/")
        width_mm, height_mm = info.get("dimensions", [2000, 2000])
        index["sets"][entry["role"]] = {
            "id": asset,
            "name": info.get("name", asset),
            "url": f"https://polyhaven.com/a/{asset}",
            "license": "CC0 1.0",
            "authors": info.get("authors", {}),
            "tile_m": [width_mm / 1000.0, height_mm / 1000.0],
            "files": written,
        }
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)
    print(f"wrote {os.path.join(OUT, 'index.json')} with {len(index['sets'])} sets")


if __name__ == "__main__":
    main()
