"""
Fetch the render's stand-in models.

    python scripts/models.py

Reads blender/models.json and downloads each model's GLB through the Sketchfab
Download API into build/models/<id>/model.glb, then writes
build/models/index.json with each file's sha256 and the licence and
attribution the manifest carries. A model already on disk is not downloaded
again. The API token is read from SKETCHFAB_TOKEN, or from a line
`SKETCHFAB_TOKEN=...` in ~/.seked/keys.env, which is outside the repository;
it is never printed or written anywhere.

Standard library only.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, "blender", "models.json")
OUT = os.path.join(ROOT, "build", "models")
KEYS = os.path.join(os.path.expanduser("~"), ".seked", "keys.env")


def token():
    value = os.environ.get("SKETCHFAB_TOKEN")
    if not value and os.path.exists(KEYS):
        for line in open(KEYS, encoding="utf-8"):
            if line.strip().startswith("SKETCHFAB_TOKEN="):
                value = line.split("=", 1)[1].strip()
    if not value:
        sys.exit(f"no Sketchfab token: set SKETCHFAB_TOKEN or put SKETCHFAB_TOKEN=... in {KEYS}")
    return value


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    index = {"models": {}}
    auth = None
    for model in manifest["models"]:
        folder = os.path.join(OUT, model["id"])
        path = os.path.join(folder, "model.glb")
        if not os.path.exists(path):
            auth = auth or {"Authorization": f"Token {token()}"}
            request = urllib.request.Request(f"https://api.sketchfab.com/v3/models/{model['sketchfab']}/download", headers=auth)
            links = json.load(urllib.request.urlopen(request, timeout=60))
            if "glb" not in links:
                sys.exit(f"{model['id']}: Sketchfab offers no GLB for {model['sketchfab']}")
            os.makedirs(folder, exist_ok=True)
            data = urllib.request.urlopen(links["glb"]["url"], timeout=600).read()
            with open(path, "wb") as f:
                f.write(data)
            print(f"{model['id']}: {len(data) / 1e6:.1f} MB")
        index["models"][model["id"]] = {
            "file": os.path.relpath(path, OUT).replace(os.sep, "/"),
            "sha256": sha256_of(path),
            "license": model["license"],
            "attribution": model["attribution"],
        }
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print(f"wrote {os.path.join(OUT, 'index.json')} with {len(index['models'])} models")


if __name__ == "__main__":
    main()
