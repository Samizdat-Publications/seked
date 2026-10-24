"""
The exhibit's ambient sound: one looping bed for each kind of place and hour, generated with ElevenLabs' sound
effects model.

    python scripts/ambient.py [BED ...]      # all beds when none is named

Writes assets/narration/ambient-<bed>.mp3 (Git LFS, served at /narration/ and copied by `pnpm site`), each about
22 seconds and made to loop, and assets/narration/ambient.json with the prompt each was made from. The player
(apps/exhibit/src/ambient.ts) picks a bed by a leaf's station, moment and era, and keeps it quiet under the voice.
Generated, not recorded at Giza: a look (and listen) choice like the skies. The key is ELEVENLABS_API_KEY in the
environment and is never printed. Standard library only.
"""
import json
import os
import sys
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "assets", "narration")
BEDS = {
    "today": "Clearly audible outdoor ambience recorded on an open desert plateau beside a big city: steady gusting wind "
             "over sand and stone, a continuous distant city murmur of traffic below, an occasional far-off horn. "
             "No voices nearby, no music.",
    "built": "Clearly audible outdoor ambience of an ancient building site on a desert plateau above a river: steady "
             "dry wind, river birds calling below, and in the distance many copper chisels tapping on limestone. "
             "No modern sounds, no voices nearby, no music.",
    "green": "Ambience of a lush green savanna by a river: a gentle breeze through tall grass, scattered birdsong, insects, "
             "distant water. Peaceful, no voices, no music.",
    "night": "Clearly audible night ambience outdoors in a warm desert: a steady chorus of crickets and night insects, "
             "a soft breeze, a distant owl calling once. No voices, no music.",
    "inside": "Ambience inside a huge sealed granite chamber deep in a pyramid: a deep low room tone, faint air moving, "
              "the stillness of heavy stone. Very quiet, no voices, no music.",
}


def generate(bed):
    body = {"text": BEDS[bed], "duration_seconds": 22, "prompt_influence": 0.45, "loop": True,
            "model_id": "eleven_text_to_sound_v2"}
    req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
    data = urllib.request.urlopen(req, timeout=300).read()
    path = os.path.join(OUT, f"ambient-{bed}.mp3")
    open(path, "wb").write(data)
    print(f"wrote {path}: {len(data) / 1e3:.0f} kB", flush=True)


def normalise(bed, lufs=-30.0):
    """Every bed to one loudness, so the player's single level suits them all (the model's levels differ by 50 dB)."""
    import subprocess
    path = os.path.join(OUT, f"ambient-{bed}.mp3")
    tmp = path + ".tmp.mp3"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path, "-af",
                    f"loudnorm=I={lufs}:TP=-6:LRA=11", "-ar", "44100", "-b:a", "128k", tmp], check=True)
    os.replace(tmp, path)


def main(names):
    if "ELEVENLABS_API_KEY" not in os.environ:
        sys.exit("no ELEVENLABS_API_KEY in the environment")
    for bed in names or list(BEDS):
        generate(bed)
    for bed in BEDS:
        normalise(bed)
    json.dump({"made_by": "scripts/ambient.py", "model": "eleven_text_to_sound_v2", "beds": BEDS,
               "note": "generated ambience, not recordings; a look choice like the skies"},
              open(os.path.join(OUT, "ambient.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1:])
