"""
Tighten a narration take: every pause longer than PAUSE is cut to PAUSE, then the whole read is sped up by TEMPO
with its pitch kept (ffmpeg's atempo), and the take's character timings are moved to match.

    python scripts/tighten.py IN.mp3 OUT.mp3 [--pause 0.45] [--tempo 1.0]

Used by scripts/voice_lab.py apply, which keeps the untouched take in build/voice-lab/ so tightening is never done
twice. ffmpeg on PATH; standard library only.
"""
import argparse
import re
import subprocess

NOISE = "-38dB"


def silences(path, shortest):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=noise={NOISE}:d={shortest}",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends))


def tighten(src, dst, pause=0.45, tempo=1.0):
    """Write the tightened take and return a function mapping an old time (s) to the new one."""
    cuts = []   # (start, end) of audio removed: the middle of each long pause
    for a, b in silences(src, pause):
        excess = (b - a) - pause
        if excess > 0.02:
            mid = (a + b) / 2
            cuts.append((mid - excess / 2, mid + excess / 2))
    keep, t = [], 0.0
    for a, b in cuts:
        keep.append((t, a))
        t = b
    keep.append((t, None))
    parts = []
    for i, (a, b) in enumerate(keep):
        end = f":end={b:.4f}" if b is not None else ""
        parts.append(f"[0:a]atrim=start={a:.4f}{end},asetpts=PTS-STARTPTS[s{i}]")
    graph = ";".join(parts) + ";" + "".join(f"[s{i}]" for i in range(len(keep))) + \
        f"concat=n={len(keep)}:v=0:a=1[c];[c]atempo={tempo}[out]"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-filter_complex", graph,
                    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", dst], check=True)

    def remap(x):
        removed = 0.0
        for a, b in cuts:
            if x >= b:
                removed += b - a
            elif x > a:
                removed += x - a
        return round((x - removed) / tempo, 3)
    return remap, sum(b - a for a, b in cuts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--pause", type=float, default=0.45)
    ap.add_argument("--tempo", type=float, default=1.0)
    o = ap.parse_args()
    _, saved = tighten(o.src, o.dst, o.pause, o.tempo)
    print(f"{o.dst}: {saved:.1f} s of pause removed, tempo {o.tempo}")


if __name__ == "__main__":
    main()
