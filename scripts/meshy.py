"""
Generate a stand-in model with Meshy from freely licensed photographs.

    python scripts/meshy.py generate ID [--tag TAG] [--image FILE ...]   # spend credits: photographs -> build/models/ID[-TAG]/model.glb
    python scripts/meshy.py balance

A stand-in in blender/models.json may carry a `meshy` block instead of a
`sketchfab` id: the endpoint (`image-to-3d` or `multi-image-to-3d`), the
photographs by Wikimedia Commons file name, and the options sent with them.
For a form nothing photographs, because it no longer exists, the endpoint is
`text-to-3d`: a `prompt` builds the mesh (Meshy's preview) and `refine`
options texture it, and the prompt is the whole of what the model was told.
For a form that is lost but whose body still stands, the endpoint is
`restyle`: the photographs of what stands go to Meshy's image-to-image model
with an `image_prompt` saying what to restore or change, the images it makes
are kept beside the model, and those images are built into the mesh by
multi-image to 3D, so the proportions come from the photographs and only the
restored parts from the prompt.
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
API = "https://api.meshy.ai/openapi"
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
    # Paths name their API version only when it is not v1: text to 3D lives under v2.
    url = f"{API}/{path}" if path.startswith("v2/") else f"{API}/v1/{path}"
    request = urllib.request.Request(url, data=data, method=method, headers={
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
    if endpoint == "text-to-3d":
        return finish(args, spec, *from_text(spec), photos=[])
    photos, uris = [], []
    if endpoint == "restyle" and args.image:
        sys.exit("restyle takes its photographs from the manifest")
    if spec.get("from_made"):
        # Start from images an earlier restyle made (kept under ~/.seked/models/<name>/made-*.png),
        # when one of those already has the pose and the carving right and only a part should change.
        folder = os.path.join(KEEP, spec["from_made"])
        for name in sorted(n for n in os.listdir(folder) if n.startswith("made-") and n.endswith(".png")):
            data = open(os.path.join(folder, name), "rb").read()
            photos.append({"file": f"{spec['from_made']}/{name}", "page": None, "license": "generated"})
            uris.append("data:image/png;base64," + base64.b64encode(data).decode())
            print(f"made image {spec['from_made']}/{name}, {len(data) / 1e6:.1f} MB")
        return finish(args, spec, *restyled(spec, uris), photos=photos)
    if args.image and not args.tag:
        sys.exit("--image tries other photographs, so give it a --tag to keep the result apart")
    for title in args.image or spec["images"]:
        data, record = commons(title, spec.get("width", 2048))
        photos.append(record)
        uris.append("data:image/jpeg;base64," + base64.b64encode(data).decode())
        print(f"photograph {record['file']} ({record['license']}), {len(data) / 1e6:.1f} MB")
    if endpoint == "restyle":
        return finish(args, spec, *restyled(spec, uris), photos=photos)
    body = dict(spec.get("options", {}))
    if endpoint == "multi-image-to-3d":
        body["image_urls"] = uris
    else:
        body["image_url"] = uris[0]
    task_id = call("POST", endpoint, body)["result"]
    print(f"task {task_id} created on {endpoint}")
    return finish(args, spec, task_id, wait(endpoint, task_id), photos)


def wait(endpoint, task_id):
    while True:
        task = call("GET", f"{endpoint}/{task_id}")
        if task["status"] in ("SUCCEEDED", "FAILED", "CANCELED"):
            break
        print(f"  {task['status']} {task.get('progress', 0)}%", flush=True)
        time.sleep(20)
    if task["status"] != "SUCCEEDED":
        sys.exit(f"task {task_id} {task['status']}: {task.get('task_error')}")
    return task


def from_text(spec):
    """Meshy's two stages for a prompt: the untextured mesh, then its texture; the refine task is the result."""
    endpoint = "v2/text-to-3d"
    body = dict(spec.get("options", {}), mode="preview", prompt=spec["prompt"])
    preview = call("POST", endpoint, body)["result"]
    print(f"preview task {preview} created")
    done = wait(endpoint, preview)
    print(f"preview {preview}: {done.get('consumed_credits')} credits")
    refine = call("POST", endpoint, dict(spec.get("refine", {}), mode="refine", preview_task_id=preview))["result"]
    print(f"refine task {refine} created")
    task = wait(endpoint, refine)
    task["consumed_credits"] = (task.get("consumed_credits") or 0) + (done.get("consumed_credits") or 0)
    task["preview_task"] = preview
    return refine, task


def restyled(spec, uris):
    """The photographs changed by the image model, then built into a mesh; the made images ride along on the task."""
    options = dict(spec.get("image_options", {}))
    # One photograph at a time keeps each restored image on its own photograph's
    # camera and proportions; all of them at once lets the model invent a statuette.
    batches = [[u] for u in uris] if options.pop("per_image", False) else [uris]
    urls, credits, image_tasks = [], 0, []
    for batch in batches:
        image_task = call("POST", "image-to-image", dict(options, prompt=spec["image_prompt"], reference_image_urls=batch))["result"]
        print(f"image-to-image task {image_task} created")
        images = wait("image-to-image", image_task)
        urls.extend(images["image_urls"][:1] if len(batches) > 1 else images["image_urls"])
        credits += images.get("consumed_credits") or 0
        image_tasks.append(image_task)
    print(f"image-to-image: {len(urls)} images, {credits} credits")
    images = {"consumed_credits": credits}
    image_task = ", ".join(image_tasks)
    mesh_body = dict(spec.get("options", {}), image_urls=urls[:4])
    mesh_task = call("POST", "multi-image-to-3d", mesh_body)["result"]
    print(f"multi-image-to-3d task {mesh_task} created")
    task = wait("multi-image-to-3d", mesh_task)
    task["consumed_credits"] = (task.get("consumed_credits") or 0) + (images.get("consumed_credits") or 0)
    task["image_task"] = image_task
    task["made_images"] = urls
    return mesh_task, task


def finish(args, spec, task_id, task, photos):
    endpoint = spec["endpoint"]
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
    for i, url in enumerate(task.get("made_images") or []):
        with open(os.path.join(folder, f"made-{i}.png"), "wb") as f:
            f.write(urllib.request.urlopen(url, timeout=120).read())
    record = {"task": task_id, "preview_task": task.get("preview_task"), "image_task": task.get("image_task"), "endpoint": endpoint,
              "prompt": spec.get("prompt"), "image_prompt": spec.get("image_prompt"), "image_options": spec.get("image_options"),
              "options": spec.get("options", {}), "refine": spec.get("refine"), "photographs": photos,
              "consumed_credits": task.get("consumed_credits"), "finished_at": task.get("finished_at"),
              "sha256": sha256_of(path)}
    with open(os.path.join(folder, "task.json"), "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2, ensure_ascii=False)
    keep = os.path.join(KEEP, name)
    shutil.copytree(folder, keep, dirs_exist_ok=True)
    print(f"{name}: {os.path.getsize(path) / 1e6:.1f} MB, {task.get('consumed_credits')} credits, sha256 {record['sha256']}")
    print(f"kept a copy in {keep}")


def retexture(args):
    """
    A pinned model's surface painted again by Meshy's retexture from the manifest's
    `meshy.retexture` block: its `text_style_prompt` and options. The model goes in as
    its own generation task where Meshy accepts that, and as the GLB itself where not.
    The result lands in build/models/<ID>-<TAG>/ like any generation, and is kept.
    """
    model = next((m for m in json.load(open(MANIFEST, encoding="utf-8"))["models"] if m["id"] == args.id), None)
    if not model or "retexture" not in model.get("meshy", {}):
        sys.exit(f"{args.id}: no meshy.retexture block in {MANIFEST}")
    spec = dict(model["meshy"]["retexture"])
    if args.style:
        # A named prompt from `retexture_tries`, so tries started together cannot pick up each other's edits to the manifest.
        spec["text_style_prompt"] = model["meshy"]["retexture_tries"][args.style]
    body = dict(spec.get("options", {}), text_style_prompt=spec["text_style_prompt"])
    body["input_task_id"] = model["meshy"]["task"]
    request = urllib.request.Request(f"{API}/v1/retexture", data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    try:
        task_id = json.load(urllib.request.urlopen(request, timeout=300))["result"]
    except urllib.error.HTTPError as error:
        print(f"retexture by task refused ({error.code}: {error.read().decode(errors='replace')[:200]}); sending the GLB")
        path = os.path.join(OUT, args.id, "model.glb")
        body.pop("input_task_id")
        body["model_url"] = "data:application/octet-stream;base64," + base64.b64encode(open(path, "rb").read()).decode()
        task_id = call("POST", "retexture", body)["result"]
    print(f"retexture task {task_id} created")
    task = wait("retexture", task_id)
    spec["endpoint"] = "retexture"
    spec["prompt"] = spec["text_style_prompt"]
    args.tag = args.tag or "retextured"
    return finish(args, spec, task_id, task, photos=[])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("generate")
    p.add_argument("id")
    p.add_argument("--tag")
    p.add_argument("--image", action="append")
    p.set_defaults(func=generate)
    p = sub.add_parser("retexture")
    p.add_argument("id")
    p.add_argument("--tag")
    p.add_argument("--style")
    p.set_defaults(func=retexture)
    sub.add_parser("balance").set_defaults(func=lambda args: print(f"{call('GET', 'balance')['balance']} credits"))
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
