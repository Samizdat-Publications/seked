"""
Keep every render, not just the milestones.

    python scripts/log-render.py build/section.png --view section --note "..."

`docs/progress/` holds the numbered snapshots, which are chosen: one per
milestone, each written up in its README. This keeps the other kind of record,
the one nobody chooses. Every render made while working goes into
`docs/progress/log/` under a name that sorts by when it was taken, with what
it is written into the file itself and into an index beside it. The washed-out
first attempt and the one where the corbels came out hatched are worth as much
to a record of how this was built as the frame that was kept, and they are
exactly the frames that get overwritten.

A file is named `<utc timestamp>--<view>--<commit>.png`, so the log is in
order on disk and each frame says which commit of the project drew it. The
same facts go into the PNG's own tEXt chunks, so a frame that leaves this
folder still knows what it is, and into `docs/progress/log/index.json`, so
something can be made of the sequence later without parsing file names.

Dependency-free on purpose, like everything in `blender/`: the PNG chunks are
written here rather than by a library, because the only thing being added is a
few strings before the image data and adding a dependency to do it would be
the larger change. Python 3.8 or later, standard library only.
"""
import argparse
import binascii
import datetime as dt
import json
import os
import shutil
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LOG_DIR = os.path.join(ROOT, "docs", "progress", "log")
INDEX = os.path.join(LOG_DIR, "index.json")

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def git(*args, default=""):
    """A git fact, or `default` where git cannot answer. Never fatal: a render is worth keeping either way."""
    try:
        out = subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return default
    return out.stdout.strip() if out.returncode == 0 else default


def read_chunks(data):
    """A PNG as (type, payload) pairs. Raises where the file is not one."""
    if not data.startswith(PNG_MAGIC):
        raise ValueError("not a PNG: the signature is missing")
    chunks = []
    i = len(PNG_MAGIC)
    while i < len(data):
        (length,) = struct.unpack(">I", data[i:i + 4])
        kind = data[i + 4:i + 8]
        payload = data[i + 8:i + 8 + length]
        chunks.append((kind, payload))
        i += 12 + length
    return chunks


def build_chunk(kind, payload):
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", binascii.crc32(body) & 0xFFFFFFFF)


def text_chunk(keyword, value):
    """A tEXt chunk. Keywords and values are Latin-1 by the spec, so anything else is transliterated away."""
    key = keyword.encode("latin-1", "replace")[:79]
    val = str(value).encode("latin-1", "replace")
    return build_chunk(b"tEXt", key + b"\x00" + val)


def stamp(data, fields):
    """The same PNG with `fields` written in as tEXt, replacing any of those keywords it already carried."""
    chunks = read_chunks(data)
    keep = [c for c in chunks if not (c[0] == b"tEXt" and c[1].split(b"\x00", 1)[0].decode("latin-1") in fields)]
    out = bytearray(PNG_MAGIC)
    written = False
    for kind, payload in keep:
        # tEXt must come before the image data; IDAT is where it stops being legal.
        if kind == b"IDAT" and not written:
            for key, value in fields.items():
                out += text_chunk(key, value)
            written = True
        out += build_chunk(kind, payload)
    if not written:
        raise ValueError("not a PNG: no IDAT chunk to put the text before")
    return bytes(out)


def load_index():
    if not os.path.exists(INDEX):
        return []
    try:
        with open(INDEX, encoding="utf-8") as handle:
            rows = json.load(handle)
    except (OSError, ValueError):
        return []
    return rows if isinstance(rows, list) else []


def main():
    parser = argparse.ArgumentParser(description="Copy a render into the progress log, stamped and indexed.")
    parser.add_argument("image", help="the PNG to log, usually something under build/")
    parser.add_argument("--view", default="", help="which view drew it: section, dawn, akhet, night, cutaway")
    parser.add_argument("--note", default="", help="one line on what this frame shows or what was being tried")
    parser.add_argument("--kept", action="store_true", help="mark a frame that also became a numbered snapshot")
    args = parser.parse_args()

    source = os.path.abspath(args.image)
    if not os.path.exists(source):
        raise SystemExit("no such file: %s" % source)
    with open(source, "rb") as handle:
        data = handle.read()

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    commit = git("rev-parse", "--short", "HEAD", default="unknown")
    dirty = git("status", "--porcelain") != ""
    view = args.view or os.path.splitext(os.path.basename(source))[0]

    stamp_name = now.strftime("%Y-%m-%dT%H-%M-%SZ")
    name = "%s--%s--%s%s.png" % (stamp_name, view, commit, "-dirty" if dirty else "")
    os.makedirs(LOG_DIR, exist_ok=True)
    target = os.path.join(LOG_DIR, name)

    fields = {
        "Title": "Seked render: %s" % view,
        "Software": "Blender, via blender/render.py",
        "Source": "https://github.com/Samizdat-Publications/seked",
        "Creation Time": now.isoformat(),
        "Comment": args.note,
        "seked:view": view,
        "seked:commit": commit,
        "seked:tree": "dirty" if dirty else "clean",
        "seked:kept": "yes" if args.kept else "no",
    }
    with open(target, "wb") as handle:
        handle.write(stamp(data, fields))

    rows = load_index()
    rows.append({
        "file": name,
        "taken": now.isoformat(),
        "view": view,
        "commit": commit,
        "tree": "dirty" if dirty else "clean",
        "kept": bool(args.kept),
        "note": args.note,
        "bytes": os.path.getsize(target),
    })
    rows.sort(key=lambda r: (r.get("taken", ""), r.get("file", "")))
    with open(INDEX, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(rows, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print("logged %s (%d in the log)" % (name, len(rows)))


if __name__ == "__main__":
    main()
