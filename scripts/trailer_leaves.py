"""
Build chapter 0's leaves, the trailer, from the money shots of the beats it previews: each of its sentences gets the
station, era, moment and view of one leaf already in the exhibit (so nothing new needs rendering), and the arrivals
are set by the file's rules.

    python scripts/trailer_leaves.py      # after scripts/recut_leaves.py; run the tests after it

Written for script version 3 (22 October 2026). SHOTS pairs each trailer sentence, in order, with the leaf whose
picture it borrows; a sentence past the list takes the last one.
"""
import json
import subprocess
import sys

sys.path.insert(0, "scripts")
import narrate_script as ns  # noqa: E402
from recut_leaves import arrivals, sentences  # noqa: E402

# (the leaf whose shot it borrows, figures to draw): one per trailer sentence, in order
SHOTS = [
    ("ch0-textbooks", []),     # every textbook says ... Khafre
    ("ch1-cautious", []),      # rain wore it down: the long-rains flank
    ("ch2-lion", []),          # a lion first, watching its constellation rise
    ("ch3-statues", []),       # its temples older than the king who used them
    ("ch5-belt", []),          # the First Time, in the stars and in numbers: the belt over the plateau
    ("ch7-built", ["vulture-sky"]),  # Göbekli Tepe
    ("ch8-rooms", ["khafre-wells"]),  # rooms underground
    ("ch0-claim", []),         # a civilisation lost at the end of the Ice Age
    ("ch0-question", []),      # the case at its strongest, and the replies
    ("ch0-promise", []),       # what it would take to settle it
]


def main():
    path = "apps/exhibit/leaves.json"
    doc = json.load(open(path, encoding="utf-8"))
    # the shots are borrowed from version 2's leaves (ab3309b), before version 3's recut dropped some of them
    before = json.loads(subprocess.run(["git", "show", "ab3309b:apps/exhibit/leaves.json"], capture_output=True,
                                       check=True).stdout)
    by_id = {L["id"]: L for L in before["leaves"]}
    text = ns.chapters(open(ns.SCRIPT, encoding="utf-8").read())[0][0]
    said = sentences(text)
    # two short sentences may share a leaf (the file's rule is at most two): the last three lines pair up as two
    groups = said[:9] + [" ".join(said[9:])] if len(said) > 10 else said
    trailer = []
    for k, say in enumerate(groups):
        src_id, draw = SHOTS[min(k, len(SHOTS) - 1)]
        src = by_id[src_id]
        trailer.append({"id": f"ch0-t{k + 1:02d}", "chapter": 0, "station": src["station"], "era": src["era"],
                        "moment": src["moment"], "view": dict(src["view"]), "arrive": "cut", "say": say,
                        "draw": draw, "hold": 0.3, "interact": src["interact"] if src["interact"] in ("look", "sky") else "look", "receipts": [], "reply": "ch0"})
    rest = [L for L in doc["leaves"] if L["chapter"] != 0]
    out = trailer + rest
    walk = json.load(open("apps/walk/stations.json", encoding="utf-8"))
    stations = {t["id"]: t for t in (walk["stations"] if isinstance(walk, dict) else walk)}
    report = []
    arrivals(out, stations, report)
    doc["leaves"] = out
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    for L in trailer:
        print(f"{L['id']}: {L['station']} {L['era']} ({L['arrive']}): {L['say'][:70]}")


if __name__ == "__main__":
    main()
