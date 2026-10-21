"""
Record the exhibit as a visitor would see and hear it, for a critic: narrated play from one leaf to another,
untouched, with the recorded narration laid under the picture.

    python scripts/capture_exhibit.py [--from ch0-dawn] [--to ch0-ditch] [--out build/critic/ch0.mp4]
                                      [--size 1280x720] [--url http://localhost:5199/]

Starts the exhibit's dev server (unless --url names one already running), opens the page in Chromium with
Playwright's `record_video_dir`, muted (the browser's sound never reaches the speakers), and presses Play on the
first leaf. It records in real time until play leaves the last leaf or stops. The player keeps a log of what it
played (`player.log` in `apps/exhibit/src/player.ts`): each leaf as it went on the stage and each span of a
chapter's recording from when it sounded to where it stopped. The script lays those spans of
`assets/narration/chN.mp3` under the video at those times with the ffmpeg `imageio_ffmpeg` gives, into one mp4,
and writes a JSON of the timeline beside it. A leaf the browser's voice said (its words not in the recording)
is silent in the mp4 and listed in the JSON as `voice`. The replies are not in narrated play, so not here.

If `apps/web/public/seked.json` exists (`pnpm bundle`) it is served to the page, so receipts and the figures that
read the monuments draw as on the site.
"""
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NARRATION = os.path.join(REPO, "assets", "narration")
BUNDLE = os.path.join(REPO, "apps", "web", "public", "seked.json")
LEAD_IN = 0.5   # seconds of the stage kept before Play is pressed


def leaf_ids():
    with open(os.path.join(REPO, "apps", "exhibit", "leaves.json"), encoding="utf-8") as f:
        data = json.load(f)
    return [L["id"] for L in (data["leaves"] if isinstance(data, dict) else data)]


def leaf_range(ids, first, last):
    """The leaves from `first` to `last`, both included; the defaults are chapter 0's first and last."""
    first = first or ids[0]
    if first not in ids:
        raise SystemExit(f"no leaf {first} in apps/exhibit/leaves.json")
    if last is None:
        ch = first.split("-")[0]
        last = [i for i in ids if i.split("-")[0] == ch][-1]
    for x in (first, last):
        if x not in ids:
            raise SystemExit(f"no leaf {x} in apps/exhibit/leaves.json")
    a, b = ids.index(first), ids.index(last)
    if b < a:
        raise SystemExit(f"{last} comes before {first}")
    return ids[a:b + 1]


def stop_time(log, leaves, pressed_ms, stopped_ms):
    """When play left the range: the first leaf outside it put on the stage after Play, or when recording stopped."""
    for e in log:
        if e.get("kind") == "leaf" and e["at"] > pressed_ms and e["leaf"] not in leaves:
            return min(e["at"], stopped_ms)
    return stopped_ms


def audio_plan(log, origin_ms, until_ms=float("inf"), min_len=0.05):
    """
    The spans of recording that sounded, each as (file, start, end, delay): seconds into its mp3 and seconds after
    `origin_ms` (wall-clock milliseconds) at which it sounded. Spans cut off before they were heard, and any that
    began at or after `until_ms`, are left out.
    """
    out = []
    for e in log:
        if e.get("kind") != "span" or e["end"] - e["start"] < min_len or e["at"] >= until_ms:
            continue
        out.append((e["file"], e["start"], e["end"], max(0.0, (e["at"] - origin_ms) / 1000)))
    return out


def timeline(log, origin_ms):
    """The log in seconds from `origin_ms`, for the JSON beside the mp4."""
    rows = []
    for e in log:
        r = dict(e)
        r["at"] = round((e["at"] - origin_ms) / 1000, 3)
        if r["kind"] == "span":
            r["start"], r["end"] = round(e["start"], 3), round(e["end"], 3)
        rows.append(r)
    return rows


def filter_graph(plan, duration, first_input=1):
    """
    ffmpeg's filter_complex for `plan` (audio_plan's spans): one input per mp3 from `first_input` on, in the order
    of first use, each span trimmed out of it and delayed to its time, mixed over `duration` seconds of silence so
    the sound runs the length of the picture. Returns (graph, files in input order).
    """
    files = []
    for f, *_ in plan:
        if f not in files:
            files.append(f)
    parts = [f"aevalsrc=0:channel_layout=stereo:sample_rate=44100:d={duration:.3f}[base]"]
    labels = ["[base]"]
    for k, (f, s, e, d) in enumerate(plan):
        i = first_input + files.index(f)
        ms = int(round(d * 1000))
        parts.append(f"[{i}:a]atrim=start={s:.3f}:end={e:.3f},asetpts=PTS-STARTPTS,"
                     f"aformat=sample_rates=44100:channel_layouts=stereo,adelay=delays={ms}:all=1[s{k}]")
        labels.append(f"[s{k}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=first:normalize=0:dropout_transition=0[a]")
    return ";".join(parts), files


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_dev_server():
    port = free_port()
    pnpm = shutil.which("pnpm") or "pnpm"
    proc = subprocess.Popen([pnpm, "--filter", "@seked/exhibit", "exec", "vite", "--port", str(port), "--strictPort"],
                            cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}/"
    for _ in range(120):
        try:
            urllib.request.urlopen(url, timeout=1)
            return proc, url
        except OSError:
            time.sleep(0.5)
    proc.kill()
    raise SystemExit("the exhibit's dev server did not start")


def record(url, leaves, size, video_dir):
    """Play `leaves` untouched; returns (video path, the player's log, wall ms of the video's start, of Play, of the stop)."""
    from playwright.sync_api import sync_playwright
    w, h = size
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(viewport={"width": w, "height": h}, record_video_dir=video_dir,
                                  record_video_size={"width": w, "height": h})
        if os.path.exists(BUNDLE):
            body = open(BUNDLE, "rb").read()
            ctx.route("**/seked.json", lambda r: r.fulfill(body=body, content_type="application/json"))
        before = time.time() * 1000
        page = ctx.new_page()
        opened = (before + time.time() * 1000) / 2   # the video starts with the page
        page.on("console", lambda m: print("  page:", m.text[:200]) if m.type in ("info", "error", "warning") else None)
        page.goto(f"{url}?leaf={leaves[0]}")
        page.wait_for_function("() => window.seked && window.seked.stage && window.seked.stage.ready", timeout=60000)
        page.wait_for_timeout(1000)
        pressed = time.time() * 1000
        page.evaluate("() => window.seked.player.play()")
        after = leaves[-1]
        print(f"playing {leaves[0]} to {after}, {len(leaves)} leaves, in real time")
        seen = leaves[0]
        while True:
            page.wait_for_timeout(250)
            st = page.evaluate("() => { const p = window.seked.player; return [p.leaf.id, p.playing] }")
            if st[0] != seen:
                seen = st[0]
                print(f"  {round((time.time() * 1000 - pressed) / 1000, 1):6.1f} s  {seen}")
            if seen not in leaves or not st[1]:
                break
        stopped = time.time() * 1000
        log = page.evaluate("() => window.seked.player.log")
        video = page.video.path()
        ctx.close()
        browser.close()
    return video, log, opened, pressed, stopped


def mux(video, log, leaves, opened, pressed, stopped, out):
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cut = max(0.0, (pressed - opened) / 1000 - LEAD_IN)
    origin = opened + cut * 1000
    until = stop_time(log, leaves, pressed, stopped)
    duration = (until - origin) / 1000
    plan = audio_plan(log, origin, until)
    graph, files = filter_graph(plan, duration)
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-ss", f"{cut:.3f}", "-i", video]
    for f in files:
        cmd += ["-i", os.path.join(NARRATION, f)]
    cmd += ["-filter_complex", graph, "-map", "0:v", "-map", "[a]", "-t", f"{duration:.3f}", "-r", "30",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", out]
    subprocess.run(cmd, check=True)
    return origin, duration, plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="first")
    ap.add_argument("--to", dest="last")
    ap.add_argument("--out", default=os.path.join(REPO, "build", "critic", "exhibit.mp4"))
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--url", help="an exhibit already being served; by default the dev server is started")
    o = ap.parse_args()
    leaves = leaf_range(leaf_ids(), o.first, o.last)
    size = tuple(int(x) for x in o.size.split("x"))
    os.makedirs(os.path.dirname(os.path.abspath(o.out)), exist_ok=True)
    server, url = (None, o.url) if o.url else start_dev_server()
    tmp = tempfile.mkdtemp(prefix="exhibit-video-")
    try:
        video, log, opened, pressed, stopped = record(url, leaves, size, tmp)
        origin, duration, plan = mux(video, log, leaves, opened, pressed, stopped, o.out)
    finally:
        if server:
            server.kill()
    rows = timeline(log, origin)
    voiced = [r["leaf"] for r in rows if r["kind"] == "voice"]
    with open(os.path.splitext(o.out)[0] + ".json", "w", encoding="utf-8") as f:
        json.dump({"leaves": leaves, "size": list(size), "duration": round(duration, 3), "timeline": rows,
                   "silent": voiced}, f, indent=1)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{o.out}: {duration:.1f} s, {len(plan)} spans of narration"
          + (f"; said by the browser's voice, silent here: {', '.join(voiced)}" if voiced else ""))


if __name__ == "__main__":
    sys.exit(main())
