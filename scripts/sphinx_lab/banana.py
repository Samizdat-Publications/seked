"""
One image from Gemini's image model (nano banana), given reference images and a prompt:

    python scripts/sphinx_lab/banana.py OUT.png --prompt "..." | --prompt-file P.txt  [--image REF ...] [--model M] [--aspect 3:2]

The references go in the order given, so a prompt can say "the first image", "the second".
The key is GEMINI_API_KEY in ~/.seked/keys.env and is never printed. Standard library only.
"""
import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models"


def key():
    for line in open(os.path.expanduser("~/.seked/keys.env"), encoding="utf-8"):
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("no GEMINI_API_KEY in ~/.seked/keys.env")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--image", action="append", default=[])
    ap.add_argument("--model", default="gemini-3-pro-image")
    ap.add_argument("--aspect", default="3:2")
    ap.add_argument("--size", default="2K")
    ap.add_argument("--meshy", action="store_true", help="run nano-banana-pro through Meshy's image-to-image (9 credits)")
    a = ap.parse_args()
    prompt = a.prompt or open(a.prompt_file, encoding="utf-8").read()
    if a.meshy:
        return via_meshy(a, prompt)
    parts = []
    for path in a.image:
        mime = mimetypes.guess_type(path)[0] or "image/png"
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(open(path, "rb").read()).decode()}})
    parts.append({"text": prompt})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"],
                                 "imageConfig": {"aspectRatio": a.aspect, "imageSize": a.size}}}
    req = urllib.request.Request(f"{API}/{a.model}:generateContent?key={key()}", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        res = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        sys.exit(f"Gemini {e.code}: {e.read().decode(errors='replace')[:600]}")
    for cand in res.get("candidates", []):
        for p in cand.get("content", {}).get("parts", []):
            data = p.get("inline_data") or p.get("inlineData")
            if data:
                os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
                open(a.out, "wb").write(base64.b64decode(data["data"]))
                print("wrote", a.out)
                return
            if p.get("text"):
                print("text:", p["text"][:300])
    sys.exit("no image in the reply: " + json.dumps(res)[:600])


def via_meshy(a, prompt):
    """The same model through Meshy's image-to-image: 16:9 at most, 9 credits an image."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import meshy
    refs = []
    for path in a.image:
        mime = mimetypes.guess_type(path)[0] or "image/png"
        refs.append(f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode())
    aspect = a.aspect if a.aspect in ("1:1", "16:9", "9:16", "4:3", "3:4") else "16:9"
    task = meshy.call("POST", "image-to-image", {"ai_model": "nano-banana-pro", "prompt": prompt[:4000],
                                                 "reference_image_urls": refs, "aspect_ratio": aspect})["result"]
    done = meshy.wait("image-to-image", task)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, "wb").write(urllib.request.urlopen(done["image_urls"][0], timeout=300).read())
    print("wrote", a.out, f"({done.get('consumed_credits')} Meshy credits)")


if __name__ == "__main__":
    main()
