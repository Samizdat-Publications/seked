"""
Cut the showcase film and poster for samizdatpublications.com from the three flights in
render/films-showcase.json, rendered into build/films/<id>/frames:

    python scripts/showcase_film.py            # showcase/film.mp4 and showcase/poster.png
    python scripts/showcase_film.py --check    # also writes 1.2:1 and 2:1 centre crops of the poster to build/showcase/

Hard cuts, no fades, strongest scene first; the poster is the film's first frame, copied from the
same PNG so the site's fade from poster to film does not jump.
"""
import json
import os
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(REPO, "render", "films-showcase.json")
OUT = os.path.join(REPO, "showcase")


def main():
    with open(SPEC, encoding="utf-8") as f:
        films = json.load(f)["films"]
    os.makedirs(OUT, exist_ok=True)
    lists = []
    for film in films:
        frames = os.path.join(REPO, "build", "films", film["id"], "frames")
        n = int(film["fps"] * film["seconds"])
        missing = [k for k in range(n) if not os.path.exists(os.path.join(frames, f"frame_{k:04d}.png"))]
        if missing:
            sys.exit(f"{film['id']}: {len(missing)} of {n} frames missing (first {missing[0]})")
        lists.append((frames, n, film["fps"]))
    fps = lists[0][2]
    inputs, chains = [], []
    for i, (frames, n, _) in enumerate(lists):
        inputs += ["-framerate", str(fps), "-i", os.path.join(frames, "frame_%04d.png")]
        chains.append(f"[{i}:v]trim=end_frame={n},setpts=PTS-STARTPTS,format=yuv420p[v{i}]")
    graph = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(len(lists))) + f"concat=n={len(lists)}:v=1:a=0[out]"
    film_path = os.path.join(OUT, "film.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-pix_fmt", "yuv420p",
                    "-r", str(fps), "-movflags", "+faststart", film_path], check=True)
    poster = os.path.join(OUT, "poster.png")
    shutil.copyfile(os.path.join(lists[0][0], "frame_0000.png"), poster)
    print(f"wrote {film_path} and {poster}")
    if "--check" in sys.argv:
        check = os.path.join(REPO, "build", "showcase")
        os.makedirs(check, exist_ok=True)
        for name, crop in (("crop-1.2", "crop=ih*1.2:ih"), ("crop-2", "crop=iw:iw/2")):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", poster, "-vf", crop + ",scale=600:-1",
                            os.path.join(check, name + ".jpg")], check=True)
        print(f"crops in {check}")


if __name__ == "__main__":
    main()
