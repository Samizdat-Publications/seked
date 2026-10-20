"""
Commit a rendered sequence's frames for the story page (apps/story/src/sequence.ts).

    python scripts/sequence_frames.py build/sequences/enclosure-d-fill enclosure-d-fill --made "render/enclosure_d.py ..."

Reads fNNN.png and its fNNN.json render record from the render directory, writes fNNN.jpg into
assets/sequences/ID/ (Git LFS) and a manifest.json there: what made it, the first frame's record (the look
choices and the stand-in note) and each frame's own camera and the fields that change from frame to frame.
The frames are previews until the laptop's finals replace them under the same names.
"""
import argparse
import glob
import json
import os

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("id")
    ap.add_argument("--made", required=True, help="the command that rendered the frames")
    ap.add_argument("--quality", type=int, default=88)
    o = ap.parse_args()
    pngs = sorted(glob.glob(os.path.join(o.src, "f[0-9][0-9][0-9].png")))
    if not pngs:
        raise SystemExit("no fNNN.png in %s" % o.src)
    out = os.path.join(REPO, "assets", "sequences", o.id)
    os.makedirs(out, exist_ok=True)
    for old in glob.glob(os.path.join(out, "f*.jpg")):
        os.remove(old)
    records = []
    for i, png in enumerate(pngs):
        if os.path.basename(png) != "f%03d.png" % i:
            raise SystemExit("frame %d is missing" % i)
        im = Image.open(png)
        im.convert("RGB").save(os.path.join(out, "f%03d.jpg" % i), quality=o.quality, optimize=True)
        with open(os.path.splitext(png)[0] + ".json", encoding="utf-8") as fh:
            records.append(json.load(fh))
    first = {k: v for k, v in records[0].items() if k != "render"}
    changes = sorted(k for k in first if any(r.get(k) != first[k] for r in records))
    manifest = dict(sequence=o.id, frames=len(pngs), size="%dx%d" % im.size, preview=True, made=o.made,
                    first=first, per_frame=[{k: r.get(k) for k in changes} for r in records])
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    print("%d frames to %s; per frame: %s" % (len(pngs), os.path.relpath(out, REPO), ", ".join(changes) or "nothing"))


if __name__ == "__main__":
    main()
