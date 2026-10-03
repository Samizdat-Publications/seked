"""
Build a mesh with Meshy from local images (made by scripts/sphinx_lab/banana.py), with Meshy 7.1:

    python scripts/sphinx_lab/mesh.py NAME IMAGE [IMAGE ...] [--texture-prompt "..."] [--no-texture] [--standard]

The first image is Meshy 7.1's primary view. The GLB, thumbnails and a task record land in
build/models/NAME/ and a copy in ~/.seked/models/NAME/, as scripts/meshy.py does; the record
names the images, so what the model was given is kept. Prints the credits spent.
"""
import argparse
import base64
import mimetypes
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import meshy  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("images", nargs="+")
    ap.add_argument("--texture-prompt")
    ap.add_argument("--no-texture", action="store_true")
    ap.add_argument("--standard", action="store_true", help="the standard geometry pass instead of the 2k Ultra pass")
    ap.add_argument("--resume", nargs="?", const="latest", help="fetch a task already created (its id, or the newest "
                    "multi-image task) instead of paying for a new one, when the waiter died")
    a = ap.parse_args()
    uris = []
    for path in a.images:
        mime = mimetypes.guess_type(path)[0] or "image/png"
        uris.append(f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode())
    options = {"ai_model": "meshy-7.1", "geometry_resolution": "standard" if a.standard else "2k",
               "should_texture": not a.no_texture, "enable_pbr": True, "texture_resolution": "4k",
               "should_remesh": False, "target_formats": ["glb"]}
    if a.texture_prompt:
        options["texture_prompt"] = a.texture_prompt
    endpoint = "multi-image-to-3d" if len(uris) > 1 else "image-to-3d"
    body = dict(options)
    if len(uris) > 1:
        body["image_urls"] = uris
    else:
        body["image_url"] = uris[0]
    if a.resume == "latest":
        task_id = meshy.call("GET", f"{endpoint}?page_size=1&sort_by=-created_at")[0]["id"]
    elif a.resume:
        task_id = a.resume
    else:
        task_id = meshy.call("POST", endpoint, body)["result"]
    print(f"task {task_id} on {endpoint}", flush=True)
    task = meshy.wait(endpoint, task_id)
    spec = {"endpoint": endpoint, "options": options}
    args = argparse.Namespace(id=a.name, tag=None)
    photos = [{"file": os.path.relpath(p, meshy.ROOT), "page": None, "license": "generated"} for p in a.images]
    meshy.finish(args, spec, task_id, task, photos)


if __name__ == "__main__":
    main()
