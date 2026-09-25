"""
Constellation figures: which star is joined to which. Imported, never typed.

`python render/alignments.py lines` reads Stellarium's modern sky culture (the IAU's 88
constellations, their figure lines as runs of Hipparcos numbers) out of a Stellarium install and
writes lines.json beside this file, with the version it came from and its licence. The stars are
matched to data/stars/hyg-bright.json by Hipparcos number; a figure star fainter than the
catalogue's magnitude limit is not in it, and the segments that need it are dropped and counted.

The figures are a modern convention and are drawn as one: the Egyptians' own Sah, Sopdet and
Mesekhtiu are not these lines.
"""
import io
import json
import os
import re

from .project import REPO

LINES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lines.json")
STELLARIUM = os.environ.get("STELLARIUM_DIR", os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Stellarium"))


def import_lines(stellarium=STELLARIUM, out=LINES):
    culture = os.path.join(stellarium, "skycultures", "modern")
    with io.open(os.path.join(culture, "index.json"), encoding="utf-8") as f:
        index = json.load(f)
    version = "unknown"
    changelog = os.path.join(stellarium, "ChangeLog.txt")
    if os.path.exists(changelog):
        with io.open(changelog, encoding="utf-8", errors="replace") as f:
            m = re.match(r"\s*([0-9.]+)\s*\[([0-9-]+)\]", f.readline())
            if m:
                version = f"{m.group(1)} ({m.group(2)})"
    licence = "CC BY-SA 4.0"
    with io.open(os.path.join(culture, "description.md"), encoding="utf-8") as f:
        m = re.search(r"##\s*License\s+Text and data:\s*([^\n]+)", f.read())
        if m:
            licence = m.group(1).strip()
    with io.open(os.path.join(REPO, "data", "stars", "hyg-bright.json"), encoding="utf-8") as f:
        cat = json.load(f)
    have = {row[0] for row in cat["stars"]}
    figures, dropped = {}, 0
    for c in index["constellations"]:
        abbr = c["id"].split()[-1]
        segs = []
        for run in c["lines"]:
            for a, b in zip(run, run[1:]):
                ha, hb = f"hip{a}", f"hip{b}"
                if ha in have and hb in have:
                    segs.append([ha, hb])
                else:
                    dropped += 1
        figures[abbr] = {"name": c.get("common_name", {}).get("native", abbr),
                         "english": c.get("common_name", {}).get("english", ""), "segments": segs}
    doc = {
        "source": f"Stellarium {version}, skycultures/modern/index.json (the IAU constellations' figure lines)",
        "licence": f"{licence}, Stellarium's modern sky culture; adapted by render/giza/alignments/lines.py (matched to hyg-4.2 by Hipparcos number)",
        "generated_by": "python render/alignments.py lines",
        "dropped_segments": dropped,
        "figures": figures,
    }
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {out}: {len(figures)} figures from {doc['source']}, {dropped} segments dropped (a star past magnitude "
          f"{cat['magnitudeLimit']})")
    return doc


def load():
    if not os.path.exists(LINES):
        raise SystemExit(f"{LINES} is missing: run python render/alignments.py lines")
    with io.open(LINES, encoding="utf-8") as f:
        return json.load(f)
