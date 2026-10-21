"""
Capture the story page as autoplay runs it, frame by frame, for the trailer (docs/plan.html, "Narration,
autoplay and the trailer").

    pnpm --filter @seked/story build
    python scripts/capture_story.py [--chapter 7 | --from 470 --to 500] [--fps 24] [--size 1280x720] [--out build/trailer/story.mp4]

Serves apps/story/dist as story/ beside the viewer's public/ as viewer/ (where the page finds seked.json on
the site), opens the page and steps its clock with `window.seked.seek(t)`, one screenshot a frame. The stage's
crossfades are CSS transitions that run in real time, so each frame waits its own duration before the shot:
the capture is slower than real time but the transitions keep their length. There is no voice yet, so the
video is silent; when the narration is recorded, its audio is muxed here. Writes the MP4 and a JSON of what it
captured beside it.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
import subprocess
import tempfile
import threading

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def serve(root):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chapter", type=int, help="capture one chapter, from its first word to the next chapter's")
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float)
    ap.add_argument("--fps", type=float, default=24.0)
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--out", default=os.path.join(REPO, "build", "trailer", "story.mp4"))
    o = ap.parse_args()
    from playwright.sync_api import sync_playwright   # the cloud has it; see scripts/record_tour.py

    dist = os.path.join(REPO, "apps", "story", "dist")
    if not os.path.exists(os.path.join(dist, "index.html")):
        raise SystemExit("build the page first: pnpm --filter @seked/story build")
    root = tempfile.mkdtemp(prefix="story-")
    os.symlink(dist, os.path.join(root, "story"))
    os.symlink(os.path.join(REPO, "apps", "web", "public"), os.path.join(root, "viewer"))
    frames = os.path.join(os.path.dirname(o.out), "frames")
    shutil.rmtree(frames, ignore_errors=True)
    os.makedirs(frames)
    w, h = (int(x) for x in o.size.split("x"))
    httpd = serve(root)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto("http://127.0.0.1:%d/story/" % httpd.server_address[1], wait_until="networkidle")
            page.wait_for_function("window.seked && window.seked.duration > 0")
            page.add_style_tag(content=".player { display: none; }")   # the trailer is the page, not its controls
            plan = page.evaluate("seked.schedule")
            t0, t1 = o.t0, o.t1 if o.t1 is not None else page.evaluate("seked.duration")
            if o.chapter is not None:
                starts = [q["t0"] for q in plan["paragraphs"] if q["chapter"] == o.chapter]
                after = [q["t0"] for q in plan["paragraphs"] if q["chapter"] > o.chapter]
                if not starts:
                    raise SystemExit("no chapter %d in the page" % o.chapter)
                t0, t1 = starts[0], (after[0] if after else page.evaluate("seked.duration"))
            n = int((t1 - t0) * o.fps) + 1
            page.evaluate("seked.seek(%f)" % t0)
            page.wait_for_load_state("networkidle")   # the sequences a chapter ahead, the stills of the first beat
            for i in range(n):
                page.evaluate("seked.seek(%f)" % (t0 + i / o.fps))
                page.wait_for_timeout(1000 / o.fps)
                page.screenshot(path=os.path.join(frames, "f%05d.png" % i))
            browser.close()
    finally:
        httpd.shutdown()
        shutil.rmtree(root, ignore_errors=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(o.fps), "-i", os.path.join(frames, "f%05d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", o.out], check=True)
    with open(os.path.splitext(o.out)[0] + ".json", "w") as f:
        json.dump({"from": t0, "to": t1, "fps": o.fps, "frames": n, "size": o.size, "chapter": o.chapter,
                   "voice": None, "note": "silent: timed at the script's 150 words a minute until the voice is recorded"}, f, indent=2)
    print("%d frames, %.1f s, to %s" % (n, t1 - t0, o.out))


if __name__ == "__main__":
    main()
