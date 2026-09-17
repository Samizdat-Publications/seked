"""
Fetch the props: the downloaded models that are placed by hand.

    python scripts/props.py

A prop is not a stand-in. A stand-in replaces a footprint and is fitted to it
by `blender/render_standins.py`; a prop is an object that stood on the plateau,
placed where `blender/props.json` says and nowhere else, and it is never fitted
to anything. Statues, the ship, the palms and the boulders are props.

This reads `blender/props.json`, downloads each prop's source model into
`build/props/<id>/`, pins the sha256 of what came down into the manifest, and
writes `build/props/index.json` for `scripts/web-assets.ts` to compress. A file
already on disk is not downloaded again; a file already pinned is checked
against its pin and the run stops if it has changed, so the compressed GLB in
`apps/web/public/props/` can always be traced to the bytes named here.

Two sources, as `scripts/models.py` and `scripts/textures.py` already use:

  sketchfab   the Download API with the token in SKETCHFAB_TOKEN or in
              ~/.seked/keys.env, which is outside the repository and is never
              printed. One GLB, saved as model.glb.
  polyhaven   `https://api.polyhaven.com/files/<id>`, the `gltf` block at the
              resolution the manifest names. That is a .gltf beside a .bin and
              its textures, so the tree is saved as it comes with the root
              renamed model.gltf, and every file is checked against the md5 the
              API publishes. The pin is the root's sha256; the includes are held
              by their md5s.

Standard library only, so it runs anywhere Python does.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, "blender", "props.json")
OUT = os.path.join(ROOT, "build", "props")
KEYS = os.path.join(os.path.expanduser("~"), ".seked", "keys.env")
POLY = "https://api.polyhaven.com"
AGENT = "seked/0.1 (personal research project; https://seked.pages.dev)"

# Everything the viewer or the compressor reads off a prop. The pipeline copies
# them through untouched: a prop is placed where the manifest says it is.
CARRIED = (
    "id", "kind", "name", "author", "url", "license", "attribution",
    "evidence", "note", "front", "ground_z", "scale_to", "keep_nodes",
    "decimate_to", "emplacements", "placements",
)


# A placement is six short numbers and belongs on one line; json.dump would
# give each of them four lines and bury the manifest's prose in them.
INLINE = {"east", "north", "up", "yaw", "scale", "tier", "sketchfab", "polyhaven", "resolution", "height_m", "length_m"}


def dumps(value, indent=0):
    """json.dumps with the short leaf objects kept on one line."""
    pad = "  " * indent
    inner = "  " * (indent + 1)
    if isinstance(value, dict):
        if value and set(value) <= INLINE:
            return json.dumps(value, ensure_ascii=False)
        if not value:
            return "{}"
        body = ",\n".join(f"{inner}{json.dumps(k, ensure_ascii=False)}: {dumps(v, indent + 1)}" for k, v in value.items())
        return f"{{\n{body}\n{pad}}}"
    if isinstance(value, list):
        if not value:
            return "[]"
        body = ",\n".join(f"{inner}{dumps(v, indent + 1)}" for v in value)
        return f"[\n{body}\n{pad}]"
    return json.dumps(value, ensure_ascii=False)


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


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, headers=None):
    request = urllib.request.Request(url, headers=headers or {"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=600) as response:
        return response.read()


def sketchfab(prop, folder, auth):
    """One GLB through the Download API, as scripts/models.py fetches a stand-in."""
    path = os.path.join(folder, "model.glb")
    if os.path.exists(path):
        return path
    uid = prop["source"]["sketchfab"]
    links = json.loads(fetch(f"https://api.sketchfab.com/v3/models/{uid}/download", auth))
    if "glb" not in links:
        sys.exit(f"{prop['id']}: Sketchfab offers no GLB for {uid}")
    os.makedirs(folder, exist_ok=True)
    data = fetch(links["glb"]["url"])
    with open(path, "wb") as f:
        f.write(data)
    print(f"{prop['id']}: {len(data) / 1e6:.1f} MB from Sketchfab")
    return path


def polyhaven(prop, folder):
    """A .gltf with its .bin and textures beside it, every file md5-checked."""
    asset = prop["source"]["polyhaven"]
    resolution = prop["source"].get("resolution", "2k")
    files = json.loads(fetch(f"{POLY}/files/{asset}"))
    spec = files.get("gltf", {}).get(resolution, {}).get("gltf")
    if spec is None:
        sys.exit(f"{prop['id']}: Poly Haven has no glTF for {asset} at {resolution}")
    os.makedirs(folder, exist_ok=True)
    # The root keeps its own relative references, so only its name changes.
    root = os.path.join(folder, "model.gltf")
    for name, part in [("model.gltf", spec)] + sorted(spec.get("include", {}).items()):
        path = os.path.join(folder, *name.split("/"))
        if os.path.exists(path) and md5_of(path) == part["md5"]:
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = fetch(part["url"])
        if hashlib.md5(data).hexdigest() != part["md5"]:
            sys.exit(f"{prop['id']}: {name} does not match the md5 the API publishes")
        with open(path, "wb") as f:
            f.write(data)
        print(f"{prop['id']}: {name} {len(data) / 1e6:.1f} MB from Poly Haven")
    return root


def main():
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    index = {"about": manifest["about"], "props": []}
    auth = None
    changed = False
    for prop in manifest["props"]:
        if prop.get("dropped"):
            print(f"{prop['id']}: dropped ({prop['dropped']}); not fetched")
            continue
        folder = os.path.join(OUT, prop["id"])
        if "sketchfab" in prop["source"]:
            auth = auth or {"Authorization": f"Token {token()}"}
            path = sketchfab(prop, folder, auth)
        elif "polyhaven" in prop["source"]:
            path = polyhaven(prop, folder)
        else:
            sys.exit(f"{prop['id']}: source is neither sketchfab nor polyhaven")
        digest = sha256_of(path)
        pinned = prop.get("sha256")
        if pinned is None:
            prop["sha256"] = digest
            changed = True
            print(f"{prop['id']}: pinned {digest[:12]}")
        elif pinned != digest:
            sys.exit(f"{prop['id']}: {path} is not the file the manifest pins ({pinned[:12]})")
        entry = {k: prop[k] for k in CARRIED if k in prop}
        entry["source"] = prop["source"]
        entry["file"] = os.path.relpath(path, OUT).replace(os.sep, "/")
        entry["sha256"] = digest
        index["props"].append(entry)
    if changed or os.environ.get("SEKED_REWRITE"):
        with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
            f.write(f"{dumps(manifest)}\n")
        print(f"pinned the new sha256s into {MANIFEST}")
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n") as f:
        f.write(f"{dumps(index)}\n")
    print(f"wrote {os.path.join(OUT, 'index.json')} with {len(index['props'])} props")


if __name__ == "__main__":
    main()
