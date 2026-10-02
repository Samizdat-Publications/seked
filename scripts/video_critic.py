"""
A blind critic that watches a recording of the guided tour (or any video) with Gemini.

    python scripts/video_critic.py VIDEO --brief BRIEF.md [--model gemini-3.8-flash] [--out build/critic/NAME.md]

The video is uploaded to the Gemini Files API, the brief is sent with it, and the critique is written to
--out (default build/critic/<video name>-<model>.md). The key is GEMINI_API_KEY in ~/.seked/keys.env,
outside the repo; it is never printed. Recordings come from a Playwright context with recordVideo (see
the tour notes): the critic should see what a visitor sees, timing and all, not stills.
"""
import argparse
import mimetypes
import os
import sys
import time

import requests

API = "https://generativelanguage.googleapis.com"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def key():
    path = os.path.expanduser(os.path.join("~", ".seked", "keys.env"))
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"no GEMINI_API_KEY in {path}")


def upload(path, k):
    mime = mimetypes.guess_type(path)[0] or "video/webm"
    size = os.path.getsize(path)
    start = requests.post(f"{API}/upload/v1beta/files", params={"key": k}, headers={
        "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(size), "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json"}, json={"file": {"display_name": os.path.basename(path)}}, timeout=60)
    start.raise_for_status()
    url = start.headers["X-Goog-Upload-URL"]
    with open(path, "rb") as f:
        done = requests.post(url, headers={"X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"},
                             data=f, timeout=600)
    done.raise_for_status()
    info = done.json()["file"]
    # A video is processed before it can be used.
    while info.get("state") == "PROCESSING":
        time.sleep(5)
        info = requests.get(f"{API}/v1beta/{info['name']}", params={"key": k}, timeout=60).json()
    if info.get("state") != "ACTIVE":
        raise SystemExit(f"upload ended in state {info.get('state')}")
    return info


def critique(video, brief, model, k):
    f = upload(video, k)
    body = {"contents": [{"parts": [{"file_data": {"mime_type": f["mimeType"], "file_uri": f["uri"]}}, {"text": brief}]}],
            "generationConfig": {"temperature": 0.4}}
    r = requests.post(f"{API}/v1beta/models/{model}:generateContent", params={"key": k}, json=body, timeout=900)
    if r.status_code != 200:
        raise SystemExit(f"{model}: {r.status_code} {r.text[:400]}")
    parts = r.json()["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--brief", required=True)
    ap.add_argument("--model", default="gemini-3.8-flash")
    ap.add_argument("--out")
    a = ap.parse_args()
    with open(a.brief, encoding="utf-8") as f:
        brief = f.read()
    text = critique(a.video, brief, a.model, key())
    out = a.out or os.path.join(REPO, "build", "critic", f"{os.path.splitext(os.path.basename(a.video))[0]}-{a.model}.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(out)


if __name__ == "__main__":
    sys.exit(main())
