"""
Generate a stand-in model with Meshy from freely licensed photographs.

    python scripts/meshy.py generate ID [--tag TAG] [--image FILE ...]   # spend credits: photographs -> build/models/ID[-TAG]/model.glb
    python scripts/meshy.py balance

A stand-in in blender/models.json may carry a `meshy` block instead of a
`sketchfab` id: the endpoint (`image-to-3d` or `multi-image-to-3d`), the
photographs by Wikimedia Commons file name, and the options sent with them.
`generate` downloads each photograph at `width` pixels, sends them as data
URIs, waits for the task, and writes the GLB, the task record and Meshy's
thumbnails into build/models/<ID>/. It also keeps a copy under
~/.seked/models/<ID>/, because Meshy's download links expire and build/ is
gitignored, and prints the task id and the GLB's sha256 for the manifest's
`meshy.task` and `meshy.sha256`. `scripts/models.py` then finds the model
there. With --tag the result goes to build/models/<ID>-<TAG>/ only, to compare
tries before one is chosen, and --image (repeated) tries other photographs
than the manifest's; the manifest is never written by this script.

What comes back is generated, not measured: an image model's guess at a form
from a handful of photographs. It is a stand-in like any other and nothing
about its form is a measurement.

The key is read from MESHY_API_KEY, or a line `MESHY_API_KEY=...` in
~/.seked/keys.env, and is never printed. Standard library only.
"""
import argparse
import base64
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, "blender", "models.json")
OUT = os.path.join(ROOT, "build", "models")
KEYS = os.path.join(os.path.expanduser("~"), ".seked", "keys.env")
KEEP = os.path.join(os.path.expanduser("~"), ".seked", "models")
API = "https://api.meshy.ai/openapi/v1"
AGENT = {"User-Agent": "seked/0.1 (Giza survey model; stand-in reference photographs)"}


def key():
    value = os.environ.get("MESHY_API_KEY")
    if not value and os.path.exists(KEYS):
        for line in open(KEYS, encoding="utf-8"):
            if line.strip().startswith("MESHY_API_KEY="):
                value = line.split("=", 1)[1].strip()
    if not value:
        sys.exit(f"no Meshy key: set MESHY_API_KEY or put MESHY_API_KEY=... in {KEYS}")
    return value


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f"{API}/{path}", data=data, method=method, headers={
        "Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(request, timeout=300))
    except urllib.error.HTTPError as error:
        sys.exit(f"Meshy {method} {path}: {error.code} {error.read().decode(errors='replace')[:500]}")


def commons(title, width):
    """A Commons file at `width` pixels, with its licence and page, as (bytes, record)."""
    title = title if title.startswith("File:") else f"File:{title}"
    query = urllib.parse.urlencode({"action": "query", "titles": title, "prop": "imageinfo", "format": "json",
                                    "iiprop": "url|extmetadata", "iiurlwidth": width,
                                    "iiextmetadatafilter": "LicenseShortName|Artist"})
    pages = json.load(urllib.request.urlopen(urllib.request.Request(
        f"https://commons.wikimedia.org/w/api.php?{query}", headers=AGENT), timeout=60))["query"]["pages"]
    info = next(iter(pages.values()))["imageinfo"][0]
    data = urllib.request.urlopen(urllib.request.Request(info["thumburl"], headers=AGENT), timeout=120).read()
    meta = info["extmetadata"]
    return data, {"file": title, "page": info["descriptionurl"], "license": meta["LicenseShortName"]["value"]}


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def generate(args):
    model = next((m for m in json.load(open(MANIFEST, encoding="utf-8"))["models"] if m["id"] == args.id), None)
    if not model or "meshy" not in model:
        sys.exit(f"{args.id}: no model with a meshy block in {MANIFEST}")
    spec = model["meshy"]
    endpoint = spec["endpoint"]
    photos, uris = [], []
    if args.image and not args.tag:
        sys.exit("--image tries other photographs, so give it a --tag to keep the result apart")
    for title in args.image or spec["images"]:
        data, record = commons(title, spec.get("width", 2048))
        photos.append(record)
        uris.append("data:image/jpeg;base64," + base64.b64encode(data).decode())
        print(f"photograph {record['file']} ({record['license']}), {len(data) / 1e6:.1f} MB")
    body = dict(spec.get("options", {}))
    if endpoint == "multi-image-to-3d":
        body["image_urls"] = uris
    else:
        body["image_url"] = uris[0]
    task_id = call("POST", endpoint, body)["result"]
    print(f"task {task_id} created on {endpoint}")
    while True:
        task = call("GET", f"{endpoint}/{task_id}")
        if task["status"] in ("SUCCEEDED", "FAILED", "CANCELED"):
            break
        print(f"  {task['status']} {task.get('progress', 0)}%", flush=True)
        time.sleep(20)
    if task["status"] != "SUCCEEDED":
        sys.exit(f"task {task_id} {task['status']}: {task.get('task_error')}")
    name = f"{args.id}-{args.tag}" if args.tag else args.id
    folder = os.path.join(OUT, name)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, "model.glb")
    with open(path, "wb") as f:
        f.write(urllib.request.urlopen(task["model_urls"]["glb"], timeout=600).read())
    thumbs = task.get("thumbnail_urls") or {"front": task.get("thumbnail_url")}
    for side, url in thumbs.items():
        if url:
            with open(os.path.join(folder, f"thumb-{side}.png"), "wb") as f:
                f.write(urllib.request.urlopen(url, timeout=120).read())
    record = {"task": task_id, "endpoint": endpoint, "options": spec.get("options", {}), "photographs": photos,
              "consumed_credits": task.get("consumed_credits"), "finished_at": task.get("finished_at"),
              "sha256": sha256_of(path)}
    with open(os.path.join(folder, "task.json"), "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2, ensure_ascii=False)
    keep = os.path.join(KEEP, name)
    shutil.copytree(folder, keep, dirs_exist_ok=True)
    print(f"{name}: {os.path.getsize(path) / 1e6:.1f} MB, {task.get('consumed_credits')} credits, sha256 {record['sha256']}")
    print(f"kept a copy in {keep}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("generate")
    p.add_argument("id")
    p.add_argument("--tag")
    p.add_argument("--image", action="append")
    p.set_defaults(func=generate)
    sub.add_parser("balance").set_defaults(func=lambda args: print(f"{call('GET', 'balance')['balance']} credits"))
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
