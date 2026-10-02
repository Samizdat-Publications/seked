"""
Record the guided tour as a visitor sees it, for scripts/video_critic.py.

    pnpm site
    python scripts/record_tour.py [--out build/critic/tour.webm] [--stops 1,3,8] [--seconds 22]

Serves site/ on a local port, opens the walk on a black page first (Playwright's blank page would
read as a white flash), starts the tour at its first stop and presses Next after each stop has
played: `--seconds` for a stop without a figure, six more for one with. With `--stops` only those
stops (1-based) are recorded, each started from its own #tour/N. Writes the video and a timeline of
when each stop began, beside it.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
import threading
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def serve(root):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=root)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(REPO, "build", "critic", "tour.webm"))
    ap.add_argument("--stops", default="")
    ap.add_argument("--seconds", type=float, default=22.0)
    ap.add_argument("--size", default="1280x720")
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright

    with open(os.path.join(REPO, "apps", "walk", "tour.json"), encoding="utf-8") as f:
        stops = json.load(f)["stops"]
    want = [int(s) for s in a.stops.split(",") if s.strip()] or list(range(1, len(stops) + 1))
    w, h = (int(n) for n in a.size.split("x"))
    httpd = serve(os.path.join(REPO, "site"))
    base = f"http://127.0.0.1:{httpd.server_address[1]}/walk/"
    vid_dir = os.path.join(os.path.dirname(os.path.abspath(a.out)), "_video")
    shutil.rmtree(vid_dir, ignore_errors=True)
    timeline = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
        ctx = browser.new_context(viewport={"width": w, "height": h}, record_video_dir=vid_dir,
                                  record_video_size={"width": w, "height": h})
        page = ctx.new_page()
        page.goto("data:text/html,<body style='background:#000;margin:0'></body>")
        t0 = time.time()
        first = True
        for n in want:
            stop = stops[n - 1]
            hold = a.seconds + (6.0 if stop.get("figure") else 0.0) + 2.0 * max(0, len(stop.get("eras", [])) - 2)
            if first or n != prev + 1:
                page.goto(base + f"#tour/{n}")
                first = False
            else:
                page.click("#tour-next")
            timeline.append((round(time.time() - t0, 1), n, stop["id"], stop.get("title", "")))
            page.wait_for_timeout(int(hold * 1000))
            prev = n
        path = page.video.path()
        ctx.close()
        browser.close()
    httpd.shutdown()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    shutil.move(path, a.out)
    shutil.rmtree(vid_dir, ignore_errors=True)
    with open(os.path.splitext(a.out)[0] + "-timeline.txt", "w", encoding="utf-8") as f:
        for t, n, sid, title in timeline:
            f.write(f"{int(t // 60):02d}:{t % 60:04.1f}  stop {n} ({sid}): {title}\n")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
