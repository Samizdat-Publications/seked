"""
Recut apps/exhibit/leaves.json to docs/script.md's narration after the script changes, keeping each leaf's place.

    python scripts/recut_leaves.py [--dry]

Each chapter's narration is split into sentences, and the sentences are assigned in order to the chapter's existing
leaves by word overlap (a monotonic best fit, so the story's order holds): a leaf takes the sentences that best
match its old words. A leaf left with no sentence is dropped and its figures pass to the next leaf kept (or the
last), so nothing drawn is lost; a cue whose word is gone (`figure@word`) draws at its leaf's start instead.
Written for the tightening of 21 October 2026 (docs/script-tight-draft.md); run the tests after it.
"""
import json, re, sys
from difflib import SequenceMatcher

sys.path.insert(0, "scripts")
import narrate_script as ns  # noqa: E402

def sentences(text):
    out = []
    for para in text.split("\n\n"):
        parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'‘“(])", para.strip())
        merged = []
        for p in parts:   # keep "c. 2350 BCE" and the like whole
            if merged and re.search(r"\b(c|ca|Dr|St|Mr|vs)\.$", merged[-1]):
                merged[-1] += " " + p
            else:
                merged.append(p)
        out += [m for m in merged if m]
    return out

def words(s):
    return re.findall(r"[a-z0-9]+", s.lower())

def sim(a, b):
    return SequenceMatcher(None, words(a), words(b)).ratio()

def fit(sents, leaves):
    S, L = len(sents), len(leaves)
    score = [[sim(s, l["say"]) for l in leaves] for s in sents]
    best = [[-1e9] * L for _ in range(S)]
    back = [[0] * L for _ in range(S)]
    for j in range(L):
        best[0][j] = score[0][j]
    for i in range(1, S):
        run, arg = -1e9, 0
        for j in range(L):
            if best[i - 1][j] > run:
                run, arg = best[i - 1][j], j
            best[i][j] = run + score[i][j]
            back[i][j] = arg
    j = max(range(L), key=lambda k: best[S - 1][k])
    path = [j]
    for i in range(S - 1, 0, -1):
        j = back[i][j]
        path.append(j)
    return path[::-1]

def camera(stations, station, era):
    st = stations.get(station) or {}
    return tuple(round(v, 3) for v in (st.get("cameras") or {}).get(era) or st.get("camera") or ())


def split_long(kept, report):
    """A leaf says one or two sentences: a longer one is split, the rest a turn in the same view."""
    out = []
    for leaf in kept:
        ss = sentences(leaf["say"])
        if len(ss) <= 2:
            out.append(leaf)
            continue
        out.append(dict(leaf, say=" ".join(ss[:2])))
        out.append(dict(leaf, id=leaf["id"] + "-b", say=" ".join(ss[2:]), draw=[], arrive="turn", receipts=leaf.get("receipts", [])))
        report.append(f"{leaf['id']}: {len(ss)} sentences, split into {leaf['id']} and {leaf['id']}-b")
    return out


def arrivals(leaves, stations, report):
    """Each leaf's way in from the one before it, by the file's own rules (apps/exhibit/src/leaves.test.ts)."""
    for i, L in enumerate(leaves):
        was = L.get("arrive")
        if i == 0:
            L["arrive"] = "cut"
        else:
            P = leaves[i - 1]
            same_place = P["station"] == L["station"] and P["moment"] == L["moment"]
            if same_place and P["era"] == L["era"]:
                L["arrive"] = "turn"
            elif same_place and camera(stations, L["station"], P["era"]) == camera(stations, L["station"], L["era"]):
                L["arrive"] = "wipe"
            elif was == "flight" and P["era"] == L["era"] and P["moment"] == L["moment"]:
                L["arrive"] = "flight"
            else:
                L["arrive"] = "cut"
        if L["arrive"] != was:
            report.append(f"{L['id']}: arrives by {L['arrive']} (was {was})")


def main():
    dry = "--dry" in sys.argv
    doc = json.load(open("apps/exhibit/leaves.json", encoding="utf-8"))
    chapters = ns.chapters(open("docs/script.md", encoding="utf-8").read())
    out, report = [], []
    for n in sorted({l["chapter"] for l in doc["leaves"]}):
        old = [l for l in doc["leaves"] if l["chapter"] == n]
        sents = sentences(chapters[n][0])
        path = fit(sents, old)
        groups = {}
        for s, j in zip(sents, path):
            groups.setdefault(j, []).append(s)
        kept, carry, act = [], [], None
        for j, leaf in enumerate(old):
            if j in groups:
                leaf = dict(leaf, say=" ".join(groups[j]))
                leaf["draw"] = carry + list(leaf.get("draw", []))
                if act and leaf.get("interact", "look") == "look":
                    leaf["interact"] = act   # an interaction (the sky, an object) outlives the words it sat on
                carry, act = [], None
                kept.append(leaf)
            else:
                carry += list(leaf.get("draw", []))
                if leaf.get("interact", "look") != "look":
                    act = leaf["interact"]
                    report.append(f"ch{n}: {leaf['id']}'s interaction '{act}' passed on")
                report.append(f"ch{n}: dropped {leaf['id']} ({len(leaf.get('draw', []))} figures passed on)")
        if carry and kept:
            kept[-1]["draw"] = list(kept[-1]["draw"]) + carry
        if act and kept and kept[-1].get("interact", "look") == "look":
            kept[-1]["interact"] = act
        for leaf in kept:
            fixed = []
            for d in leaf["draw"]:
                fig, _, word = d.partition("@")
                if word and word.lower() not in leaf["say"].lower():
                    report.append(f"ch{n}: {leaf['id']}: cue '{word}' gone, {fig} draws at the leaf's start")
                    d = fig
                if d not in fixed:
                    fixed.append(d)
            leaf["draw"] = fixed
        out += kept
        report.append(f"ch{n}: {len(old)} leaves -> {len(kept)}, {len(sents)} sentences")
    out = split_long(out, report)
    walk = json.load(open("apps/walk/stations.json", encoding="utf-8"))
    stations = {t["id"]: t for t in (walk["stations"] if isinstance(walk, dict) else walk)}
    arrivals(out, stations, report)
    print("\n".join(report))
    if not dry:
        doc["leaves"] = out
        json.dump(doc, open("apps/exhibit/leaves.json", "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
        open("apps/exhibit/leaves.json", "a", encoding="utf-8").write("\n")

if __name__ == "__main__":
    main()
