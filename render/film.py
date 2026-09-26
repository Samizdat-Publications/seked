"""
Films from rendered stills.

    python render/film.py rollback                      # the panorama shot, today back to the First Time
    python render/film.py sphinx                        # the Sphinx's sequence, Anubis to today
    python render/film.py crossfade --stills a.png b.png ... --labels "A" "B" ... --out build/films/NAME

`crossfade` holds each still, dissolves into the next and pushes in slowly across the whole
film, with each era's name and what it is (survey, reconstruction, claim) set in the
corner, composed frame by frame with Pillow. The frames are then encoded to H.264 by
Blender's own sequencer (this machine has no ffmpeg), in a background Blender that runs
this same file with `encode`:

    blender -b --factory-startup -P render/film.py -- encode --frames DIR --fps 24 --out FILE.mp4
"""
import glob
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
FONT = r"C:\Windows\Fonts\georgia.ttf"
FONT_SMALL = r"C:\Windows\Fonts\consola.ttf"


def _smooth(t):
    return t * t * (3 - 2 * t)


def crossfade(stills, labels, notes, out, hold=3.5, fade=1.6, fps=24, zoom=1.12, size=(1920, 1080)):
    """Frames for the stills in order: hold, dissolve, hold; a slow push-in over the whole film."""
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
    frames_dir = os.path.join(out, "frames")
    os.makedirs(frames_dir, exist_ok=True)
    for old in glob.glob(os.path.join(frames_dir, "*.png")):
        os.remove(old)
    ims = [np.asarray(Image.open(p).convert("RGB").resize(size, Image.LANCZOS), dtype=np.float32) for p in stills]
    n_hold, n_fade = int(hold * fps), int(fade * fps)
    timeline = []                                  # (index a, index b, mix) per frame
    for i in range(len(ims)):
        timeline += [(i, i, 0.0)] * n_hold
        if i < len(ims) - 1:
            timeline += [(i, i + 1, _smooth((k + 1) / (n_fade + 1))) for k in range(n_fade)]
    total = len(timeline)
    big = ImageFont.truetype(FONT, int(size[1] * 0.052))
    small = ImageFont.truetype(FONT_SMALL, int(size[1] * 0.022))
    W, H = size
    for f, (a, b, m) in enumerate(timeline):
        frame = ims[a] * (1 - m) + ims[b] * m
        img = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8))
        s = 1 + (zoom - 1) * _smooth(f / max(1, total - 1))          # push in, centred on the pyramids
        cw, ch = W / s, H / s
        x0, y0 = (W - cw) / 2, (H - ch) * 0.55
        img = img.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize(size, Image.LANCZOS)
        d = ImageDraw.Draw(img, "RGBA")
        # The old caption leaves in the first half of a dissolve, the new one arrives in the second: never both.
        for idx, alpha in ((a, max(0.0, 1 - 2 * m)), (b, max(0.0, 2 * m - 1))) if a != b else ((a, 1.0),):
            if alpha < 0.02:
                continue
            A = int(255 * alpha)
            x, y = int(W * 0.045), int(H * 0.80)
            d.text((x + 2, y + 2), labels[idx], font=big, fill=(0, 0, 0, int(A * 0.55)))
            d.text((x, y), labels[idx], font=big, fill=(248, 242, 230, A))
            d.text((x + 1, int(y + H * 0.075) + 1), notes[idx], font=small, fill=(0, 0, 0, int(A * 0.55)))
            d.text((x, int(y + H * 0.075)), notes[idx], font=small, fill=(232, 206, 150, A))
        img.save(os.path.join(frames_dir, f"frame_{f:04d}.png"), compress_level=1)
    print(f"{total} frames, {total / fps:.1f} s, into {frames_dir}")
    # Absolute paths: the sequencer's image strip crashes Blender on a frame it cannot find.
    mp4 = os.path.abspath(os.path.join(out, os.path.basename(out.rstrip("/\\")) + ".mp4"))
    subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.abspath(__file__), "--", "encode",
                    "--frames", os.path.abspath(frames_dir), "--fps", str(fps), "--out", mp4, "--size", f"{W}x{H}"], check=True)
    return mp4


def encode(frames_dir, mp4, fps, width, height, quality="HIGH"):
    """
    The frames as one H.264 file through Blender's sequencer (after blender/rollback.py's encode).
    `quality` is Blender's constant rate factor: HIGH for keeping, MEDIUM to fit a 15 MB web upload.
    """
    import bpy
    names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(frames_dir, "frame_*.png")))
    scene = bpy.data.scenes.new("Encode")
    scene.render.fps = fps
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.frame_start, scene.frame_end = 1, len(names)
    settings = scene.render.image_settings
    if hasattr(settings, "media_type"):
        settings.media_type = "VIDEO"
    settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = quality
    scene.render.ffmpeg.gopsize = fps
    scene.render.filepath = mp4
    editor = scene.sequence_editor_create()
    strips = editor.strips if hasattr(editor, "strips") else editor.sequences
    strip = strips.new_image("frames", filepath=os.path.join(frames_dir, names[0]), channel=1, frame_start=1)
    for name in names[1:]:
        strip.elements.append(name)
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(animation=True, scene=scene.name)
    print(f"encoded {len(names)} frames at {fps} fps into {mp4}")


def _year(epoch):
    """Astronomical year numbering to the calendar's: year 0 is 1 BCE, -2449 is 2450 BCE."""
    y = int(round(epoch))
    return f"{y} CE" if y > 0 else f"{1 - y:,} BCE"


def night_overlay(film_id, fps=24):
    """
    Letter the sky-rollback frames: the date the sky has rolled back to, the meridian star's
    altitude, and the line claim C2 draws, the King's Chamber's south shaft at its angle from the
    database, set at its true elevation in each frame from the camera's pitch and lens.
    """
    import math
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    sys.path.insert(0, HERE)
    from giza import data
    spec = next(x for x in json.load(open(os.path.join(HERE, "films.json"), encoding="utf-8"))["films"] if x["id"] == film_id)
    base = os.path.join(REPO, "build", "films", film_id)
    epochs = json.load(open(os.path.join(base, "epochs.json"), encoding="utf-8"))
    header = json.load(open(os.path.join(REPO, "build", "sky-rollback.json"), encoding="utf-8"))
    shaft = header["shaft"]["angleDeg"]
    star = header["meridian"]["name"]
    out_dir = os.path.join(base, "lettered")
    os.makedirs(out_dir, exist_ok=True)
    big = ImageFont.truetype(FONT, 46)
    small = ImageFont.truetype(FONT_SMALL, 20)
    for e in epochs:
        src = os.path.join(base, "frames", f"frame_{e['frame']:04d}.png")
        if not os.path.exists(src):
            continue
        img = Image.open(src).convert("RGB")
        W, H = img.size
        d = ImageDraw.Draw(img, "RGBA")
        pitch = max(spec.get("min_pitch", 12.0), e["meridianAltDeg"] - spec.get("below", 12.0))
        half_v = math.atan((36.0 * H / W) / 2 / spec["lens"])
        yline = H / 2 - math.tan(math.radians(shaft - pitch)) / math.tan(half_v) * H / 2
        if 0 < yline < H:
            for x in range(0, W, 14):
                d.line([(x, yline), (x + 7, yline)], fill=(232, 196, 120, 170), width=2)
            d.text((W - 16, yline - 26), f"{spec['shaft']['label']}, {shaft:.0f} deg", font=small, fill=(232, 196, 120, 220), anchor="ra")
        x0, y0 = 36, H - 118
        d.text((x0 + 2, y0 + 2), _year(e["epoch"]), font=big, fill=(0, 0, 0, 140))
        d.text((x0, y0), _year(e["epoch"]), font=big, fill=(248, 242, 230, 255))
        d.text((x0, y0 + 60), f"{star} on the meridian, {e['meridianAltDeg']:.1f} deg up; every star precessed by the sky engine",
               font=small, fill=(232, 206, 150, 235))
        img.save(os.path.join(out_dir, f"frame_{e['frame']:04d}.png"), compress_level=1)
    mp4 = os.path.abspath(os.path.join(base, f"{film_id}.mp4"))
    w, h = (int(v) for v in spec["size"].split("x"))
    subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.abspath(__file__), "--", "encode",
                    "--frames", os.path.abspath(out_dir), "--fps", str(fps), "--out", mp4, "--size", f"{w}x{h}"], check=True)
    return mp4


def rollback():
    """Today back to the First Time, from the panorama stand, 120 mm, at golden hour."""
    sys.path.insert(0, HERE)
    from giza import states
    order = ["today", "stripped", "built", "lion", "first-time"]
    stills = [os.path.join(REPO, "build", "render", "shots", f"panorama-{st}.png") for st in order]
    missing = [p for p in stills if not os.path.exists(p)]
    if missing:
        raise SystemExit(f"not rendered yet: {missing}")
    labels = [f"{states.STATES[st]['title']}, {states.STATES[st]['label']}" for st in order]
    notes = [{"survey": "the present plateau, from the survey",
              "reconstruction": "a reconstruction: what is filled in is said to be filled in",
              "claim": "a claim, drawn so it can be tested; not the record"}[states.STATES[st]["honesty"]] for st in order]
    return crossfade(stills, labels, notes, os.path.join(REPO, "build", "films", "rollback"))


def sphinx():
    """The Sphinx's sequence forward in time, from over the head of the causeway with Khufu's pyramid behind."""
    order = ["first-time", "lion", "built", "stripped", "today"]
    stills = [os.path.join(REPO, "build", "render", "shots", f"sphinx-sequence-{st}.png") for st in order]
    missing = [p for p in stills if not os.path.exists(p)]
    if missing:
        raise SystemExit(f"not rendered yet: {missing}")
    labels = ["The lion, freshly carved, c. 10,500 BCE", "The lion weathered by the rains, c. 7000 BCE",
              "Khafre's Sphinx, c. 2560 BCE", "Buried to the chest, c. 1800 CE", "Excavated, 2026"]
    notes = ["a claim: a lion facing Leo's rising, the statue the recut Sphinx is said to hide",
             "a claim: the lion worn by rain, before the king's head was cut from its own",
             "a reconstruction: the king's head, the ditch swept, his temple before it",
             "a reconstruction: the sand in the ditch as the first surveyors found it",
             "the present Sphinx, from the survey; the statue is a labelled stand-in"]
    return crossfade(stills, labels, notes, os.path.join(REPO, "build", "films", "sphinx-sequence"), zoom=1.08)


def _opts(argv):
    """--key value [value ...] pairs; a key with one value maps to it, with several to the list."""
    out, key = {}, None
    for a in argv:
        if a.startswith("--"):
            key = a[2:]
            out[key] = []
        elif key is not None:
            out[key].append(a)
    return {k: (v[0] if len(v) == 1 else v) for k, v in out.items()}


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    cmd, rest = (argv[0], argv[1:]) if argv else ("rollback", [])
    o = _opts(rest)
    if cmd == "encode":
        w, h = (int(v) for v in o.get("size", "1920x1080").split("x"))
        encode(o["frames"], o["out"], int(o.get("fps", 24)), w, h, o.get("quality", "HIGH"))
    elif cmd == "night":
        print(night_overlay(o.get("id", "sky-rollback")))
    elif cmd == "sphinx":
        print(sphinx())
    elif cmd == "crossfade":
        stills = o["stills"] if isinstance(o["stills"], list) else [o["stills"]]
        labels = o.get("labels", [os.path.basename(p) for p in stills])
        print(crossfade(stills, labels, o.get("notes", [""] * len(stills)), o["out"]))
    else:
        print(rollback())
