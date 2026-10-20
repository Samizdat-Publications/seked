"""
Record docs/script.md's narration with ElevenLabs, one file a chapter, with the time of every character.

    python scripts/narrate_script.py              # every chapter whose text changed since it was recorded
    python scripts/narrate_script.py 0 1 --force  # these chapters, again

For each chapter N it writes assets/narration/chN.mp3 (the narration) and chN-reply.mp3 (the spoken reply), and
chN.json: the exact text spoken, its sha256, the voice, the model and its settings, and each file's alignment
(characters with start and end seconds), so the exhibit's leaves are time ranges inside a chapter and a line can
draw on as its word is spoken. A chapter whose text and voice settings are unchanged is skipped.

The voice is Stewart's choice of 20 October 2026, "David - Documentary" (docs/exhibit-2026-10.md). The key is
ELEVENLABS_API_KEY in the environment and is never printed. Standard library only.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "docs", "script.md")
OUT = os.path.join(ROOT, "assets", "narration")
VOICE = {"voice_id": "ppLqTilh7rH7fbUVlXsf", "name": "David - Documentary", "model_id": "eleven_multilingual_v2",
         "voice_settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True}}


def plain(md):
    """The words as spoken: markdown emphasis, code marks and links taken out, paragraphs kept."""
    md = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", md)
    md = re.sub(r"[*_`]", "", md)
    return "\n\n".join(" ".join(p.split()) for p in md.split("\n\n") if p.strip())


def chapters(text):
    """{N: (narration, spoken reply)} from the script's '## N.' sections."""
    out = {}
    for m in re.finditer(r"^## (\d+)\. .*?$(.*?)(?=^## |\Z)", text, re.M | re.S):
        body = m.group(2)
        narr = re.search(r"^\*\*Narration\*\*.*?$(.*?)^\*\*Beats\*\*", body, re.M | re.S)
        reply = re.search(r"^\*\*Spoken reply\*\*:\s*(.+)$", body, re.M)
        if narr:
            out[int(m.group(1))] = (plain(narr.group(1)), plain(reply.group(1)) if reply else "")
    return out


def speak(text):
    body = {"text": text, "model_id": VOICE["model_id"], "voice_settings": VOICE["voice_settings"]}
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    a = d["alignment"]
    return base64.b64decode(d["audio_base64"]), {"characters": a["characters"],
                                                 "start": a["character_start_times_seconds"],
                                                 "end": a["character_end_times_seconds"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chapters", nargs="*", type=int)
    ap.add_argument("--force", action="store_true")
    o = ap.parse_args()
    if "ELEVENLABS_API_KEY" not in os.environ:
        sys.exit("no ELEVENLABS_API_KEY in the environment")
    os.makedirs(OUT, exist_ok=True)
    found = chapters(open(SCRIPT, encoding="utf-8").read())
    for n in o.chapters or sorted(found):
        narration, reply = found[n]
        digest = hashlib.sha256(json.dumps([narration, reply, VOICE], sort_keys=True).encode()).hexdigest()
        meta_path = os.path.join(OUT, f"ch{n}.json")
        if not o.force and os.path.exists(meta_path) and json.load(open(meta_path, encoding="utf-8"))["sha256"] == digest:
            print(f"ch{n}: unchanged")
            continue
        meta = {"chapter": n, "sha256": digest, "voice": VOICE, "source": "docs/script.md", "files": {}}
        for part, text in (("narration", narration), ("reply", reply)):
            if not text:
                continue
            name = f"ch{n}.mp3" if part == "narration" else f"ch{n}-reply.mp3"
            audio, alignment = speak(text)
            open(os.path.join(OUT, name), "wb").write(audio)
            meta["files"][part] = {"file": name, "text": text, "seconds": round(alignment["end"][-1], 2),
                                   "alignment": alignment}
            print(f"ch{n} {part}: {len(text.split())} words, {alignment['end'][-1]:.1f} s", flush=True)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
