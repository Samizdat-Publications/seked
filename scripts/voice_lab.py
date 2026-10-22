"""
A local page for choosing the narration take by ear: every chapter's narration and reply, each with its takes,
a player on each, the text and the voice settings editable, and a button that records a new take with ElevenLabs.

    python scripts/voice_lab.py            # serve http://localhost:5197 (the key stays on this machine)
    python scripts/voice_lab.py apply      # the picked takes into assets/narration/, tightened (TIGHTEN), alignment and all

Takes live in build/voice-lab/ (gitignored): takes/<id>.mp3 and takes.json (text, settings, alignment, which is
picked). The first run seeds each item with the current recording and the first one (git a3de4f0), so the old
and new can be heard side by side. A take whose text differs from docs/script.md is applied with a warning: the
exhibit's leaves are cut from the script, so the script must say the same words. Standard library only; the key
is ELEVENLABS_API_KEY in the environment or ~/.seked/keys.env, and is never printed or sent to the page.
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import narrate_script as ns  # noqa: E402
from tighten import tighten  # noqa: E402

LAB = os.path.join(ROOT, "build", "voice-lab")
TAKES = os.path.join(LAB, "takes")
STATE = os.path.join(LAB, "takes.json")
NARRATION = os.path.join(ROOT, "assets", "narration")
FIRST = "a3de4f0"   # the first recording, all ten chapters
PORT = 5197
# Stewart's choice by ear, 22 October 2026: pauses cut to 0.45 s and the read 15% faster, its pitch kept
TIGHTEN = {"pause": 0.45, "tempo": 1.15}


def key():
    if "ELEVENLABS_API_KEY" in os.environ:
        return os.environ["ELEVENLABS_API_KEY"]
    path = os.path.join(os.path.expanduser("~"), ".seked", "keys.env")
    for line in open(path, encoding="utf-8"):
        name, _, value = line.strip().partition("=")
        if name == "ELEVENLABS_API_KEY":
            return value.strip().strip('"')
    sys.exit("no ELEVENLABS_API_KEY in the environment or ~/.seked/keys.env")


def script_items():
    found = ns.chapters(open(ns.SCRIPT, encoding="utf-8").read())
    items = []
    for n in sorted(found):
        for part, text in zip(("narration", "reply"), found[n]):
            if text:
                items.append({"id": f"ch{n}-{part}", "chapter": n, "part": part, "text": text})
    return items


def load():
    if os.path.exists(STATE):
        return json.load(open(STATE, encoding="utf-8"))
    return {"takes": [], "picks": {}}


def save(state):
    with open(STATE + ".tmp", "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    os.replace(STATE + ".tmp", STATE)


def seed(state):
    """The current recording and the first one, as takes 1 and 2 of every item."""
    if state["takes"]:
        return
    os.makedirs(TAKES, exist_ok=True)
    for item in script_items():
        name = f"ch{item['chapter']}.mp3" if item["part"] == "narration" else f"ch{item['chapter']}-reply.mp3"
        meta = json.load(open(os.path.join(NARRATION, f"ch{item['chapter']}.json"), encoding="utf-8"))
        rec = meta["files"][item["part"]]
        for label, audio, text, alignment in (
            ("current recording", open(os.path.join(NARRATION, name), "rb").read(), rec["text"], rec["alignment"]),
            ("first recording (20 Oct)", git_bytes(f"{FIRST}:assets/narration/{name}"), None, None),
        ):
            if not audio:
                continue
            tid = f"{item['id']}-{len(state['takes']):03d}"
            open(os.path.join(TAKES, tid + ".mp3"), "wb").write(audio)
            if text is None:
                old = json.loads(git_bytes(f"{FIRST}:assets/narration/ch{item['chapter']}.json") or b"{}")
                part = old.get("files", {}).get(item["part"], {})
                text, alignment = part.get("text", ""), part.get("alignment")
            state["takes"].append({"id": tid, "item": item["id"], "label": label, "text": text,
                                   "voice": meta["voice"], "alignment": alignment, "made": None})
            state["picks"].setdefault(item["id"], tid)   # the current recording stays picked until another is
    save(state)


def git_bytes(spec):
    r = subprocess.run(["git", "-C", ROOT, "show", spec], capture_output=True)
    if r.returncode != 0:
        return None
    if r.stdout.startswith(b"version https://git-lfs"):   # the mp3s are in LFS: swap the pointer for the audio
        r = subprocess.run(["git", "-C", ROOT, "lfs", "smudge"], input=r.stdout, capture_output=True)
        return r.stdout if r.returncode == 0 and not r.stdout.startswith(b"version https://git-lfs") else None
    return r.stdout


def generate(item_id, text, voice):
    body = {"text": text, "model_id": voice["model_id"], "voice_settings": voice["voice_settings"]}
    url = (f"https://api.elevenlabs.io/v1/text-to-speech/{voice['voice_id']}/with-timestamps"
           "?output_format=mp3_44100_128")
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    a = d["alignment"]
    state = load()
    tid = f"{item_id}-{len(state['takes']):03d}"
    open(os.path.join(TAKES, tid + ".mp3"), "wb").write(base64.b64decode(d["audio_base64"]))
    take = {"id": tid, "item": item_id, "label": None, "text": text, "voice": voice, "made": time.strftime("%H:%M"),
            "alignment": {"characters": a["characters"], "start": a["character_start_times_seconds"],
                          "end": a["character_end_times_seconds"]}}
    state["takes"].append(take)
    save(state)
    return take


def batch():
    """One take in the project's voice for every item that has none, picked as the default."""
    state = load()
    for item in script_items():
        mine = [t for t in state["takes"] if t["item"] == item["id"] and t["voice"] == ns.VOICE]
        if mine:
            continue
        take = generate(item["id"], item["text"], ns.VOICE)
        state = load()
        state["picks"][item["id"]] = take["id"]
        save(state)
        print(f"{item['id']}: {take['id']}", flush=True)


def apply():
    state, script = load(), {i["id"]: i for i in script_items()}
    by_id = {t["id"]: t for t in state["takes"]}
    for item_id, tid in sorted(state["picks"].items()):
        if not tid:
            continue
        take, item = by_id[tid], script[item_id]
        if take["text"] != item["text"]:
            print(f"warning: {item_id}: the picked take's words differ from docs/script.md; update the script to match")
        if not take.get("alignment"):
            print(f"skipped {item_id}: {tid} has no alignment (re-record it in the lab)")
            continue
        n, part = item["chapter"], item["part"]
        name = f"ch{n}.mp3" if part == "narration" else f"ch{n}-reply.mp3"
        remap, _ = tighten(os.path.join(TAKES, tid + ".mp3"), os.path.join(NARRATION, name), **TIGHTEN)
        meta_path = os.path.join(NARRATION, f"ch{n}.json")
        meta = json.load(open(meta_path, encoding="utf-8"))
        a = take["alignment"]
        a = {"characters": a["characters"], "start": [remap(x) for x in a["start"]], "end": [remap(x) for x in a["end"]]}
        meta["files"][part] = {"file": name, "text": take["text"], "seconds": round(a["end"][-1], 2), "alignment": a,
                               "take": tid, "tightened": TIGHTEN}
        meta["voice"] = take["voice"]
        found = ns.chapters(open(ns.SCRIPT, encoding="utf-8").read())[n]   # so narrate_script.py sees it as current
        meta["sha256"] = hashlib.sha256(json.dumps([found[0], found[1], ns.VOICE], sort_keys=True).encode()).hexdigest()
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)
        print(f"{item_id}: {tid}")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, kind="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/":
            return self.send(200, open(os.path.join(ROOT, "scripts", "voice_lab.html"), "rb").read(), "text/html; charset=utf-8")
        if self.path == "/api/state":
            state = load()
            takes = [{k: v for k, v in t.items() if k != "alignment"} | {"aligned": bool(t.get("alignment"))}
                     for t in state["takes"]]
            return self.send(200, {"items": script_items(), "takes": takes, "picks": state["picks"],
                                   "voice": ns.VOICE})
        if self.path == "/api/samples":
            folder = os.path.join(LAB, "samples")
            names = sorted(os.listdir(folder)) if os.path.isdir(folder) else []
            return self.send(200, [n for n in names if n.endswith(".mp3")])
        if self.path.startswith("/sample/") and self.path.endswith(".mp3"):
            path = os.path.join(LAB, "samples", os.path.basename(self.path))
            if os.path.exists(path):
                return self.send(200, open(path, "rb").read(), "audio/mpeg")
        if self.path.startswith("/take/") and self.path.endswith(".mp3"):
            path = os.path.join(TAKES, os.path.basename(self.path))
            if os.path.exists(path):
                return self.send(200, open(path, "rb").read(), "audio/mpeg")
        self.send(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        try:
            if self.path == "/api/generate":
                return self.send(200, generate(body["item"], body["text"], body["voice"]) | {"alignment": None})
            if self.path == "/api/pick":
                state = load()
                state["picks"][body["item"]] = body["take"]
                save(state)
                return self.send(200, {"ok": True})
        except urllib.error.HTTPError as e:
            return self.send(502, {"error": f"ElevenLabs {e.code}: {e.read().decode(errors='replace')[:400]}"})
        except Exception as e:  # noqa: BLE001
            return self.send(500, {"error": str(e)})
        self.send(404, {"error": "not found"})


def main():
    os.makedirs(TAKES, exist_ok=True)
    if sys.argv[1:] == ["apply"]:
        return apply()
    if sys.argv[1:] == ["batch"]:
        return batch()
    key()
    seed(load())
    print(f"voice lab on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
