"""
The Sphinx lab's modeller critic: a senior 3D modeller's review of one era's lab sheets, scored out of 10.

    python scripts/sphinx_lab/critic.py DIR --era lion [--model gemini-3.1-pro-preview] [--runs 2]

DIR is a lab_sheet.py folder, tiled by tile.py. Gemini is shown the material and clay sheets, the head close
and the beds close at full size, and photographs of the real Sphinx from Commons (fetched once into
build/sphinx-lab/refs-photos/), briefed as a senior modeller reviewing a junior's sculpt, with the era's
brief and Stewart's rules and nothing about how the model was made. It answers in JSON: a score out of 10,
sub-scores, and the problems ranked, each with where on the statue and what to change. Each run is kept as
DIR/critic-<n>.json and the mean score in DIR/score.json; a critic swings a point or so between runs, so
two runs are averaged by default.
"""
import argparse
import base64
import json
import os
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "scripts"))
import meshy  # noqa: E402  (the Commons fetcher)
import video_critic  # noqa: E402  (the key and the API root)

PHOTOS = ["Giza Plateau - Great Sphinx - side view.JPG", "Giza Plateau - Great Sphinx - front view.JPG",
          "Great Sphinx 2010 rear.jpg", "Profile Sphinx.jpg"]
REFS = os.path.join(REPO, "build", "sphinx-lab", "refs-photos")

ERAS = {
    "lion": ("the Sphinx as a lion around 7000 BCE, after some three thousand years of heavy rain (the hypothesis "
             "that it was first carved as a lion and weathered by rain before Egypt dried out). It is carved from "
             "the living bedrock, layered limestone of three members: the head in a hard bed, only softened; the "
             "body in alternating hard and soft thin beds, where the soft beds are cut back into deep rounded coves "
             "and the hard beds stand out as ledges, with vertical fissures opened by water running off the top; "
             "the base and forelegs in a hard reef limestone, worn smooth. It should read as weathered natural rock "
             "that was once a carving: grain, bedding, fracture, not a smooth sculpt."),
    "first-time": ("the Sphinx as a lion on the day it was finished, around 10,500 BCE (a hypothesis): a royal "
                   "Egyptian lion's head with a stiff ruff, freshly dressed limestone with every edge crisp, but "
                   "cut from the living layered bedrock, so faint bedding and natural fissures show from day one. "
                   "Paws are squared blocks with carved toes resting on the floor; the tail a low relief on the "
                   "floor round the right haunch."),
    "today": ("the Great Sphinx as it is today: the king's head with the nemes headcloth, the nose missing, the "
              "body deeply weathered into rounded coves and ledges bed by bed, the lower body and paws cased in "
              "repair masonry of smaller blocks."),
}
STATE_OF = {"lion": "lion", "first-time": "first-time", "today": "today"}

BRIEF = """You are a senior 3D environment artist and sculptor with twenty years in film and games, reviewing a
junior's sculpt before it goes into a documentary. The model is {era}

The junior's model is shown in two sheets of seven fixed views (front, south flank, north flank, three-quarter
front, head close, back, and a close view of the body's south flank): one in its final material, one in a
uniform clay so you can judge the form alone. Then the head close and the body close at full size. After them,
photographs of the real Great Sphinx for reference: the body's mass, proportions and the way its rock weathers.
(The real head is a king's; this era's head may be different by design. Judge the head against the brief.)

The director's standing rules: realism over stylisation; the monument's body is stylised only where the real
one is (a stylised mass, no ribs or muscles, slab forelegs); damage and erosion belong on the soft body beds,
not the hard head; the paws rest on the floor; the bedding of the limestone must read; nothing showroom-clean.

Review it the way you would in dailies: what reads wrong, most damaging first, each with where on the model
(head, face, mane or headcloth, neck, back, flank, haunch, tail, forelegs, paws, base) and exactly what to
change, in modelling terms (geometry, sculpt detail, displacement, material, texture). Be specific and blunt.
Then score it out of 10 as a finished asset for a documentary shown at full screen (10 = indistinguishable
from photographed stone; 5 = obviously CG but acceptable; 3 = distracting).

Answer with JSON only, no prose outside it:
{{"score": number, "subscores": {{"form": n, "surface_detail": n, "bedding_and_weathering": n,
"material_and_colour": n, "realism": n}}, "verdict": "one sentence",
"problems": [{{"rank": 1, "where": "...", "what": "...", "fix": "..."}}, ...],
"what_works": ["..."]}}"""


def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()


def part(path):
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    return {"inline_data": {"mime_type": mime, "data": b64(path)}}


def photos():
    os.makedirs(REFS, exist_ok=True)
    out = []
    for title in PHOTOS:
        path = os.path.join(REFS, title.replace(" ", "_").rsplit(".", 1)[0] + ".jpg")
        if not os.path.exists(path):
            data, rec = meshy.commons(title, 1280)
            open(path, "wb").write(data)
            json.dump(rec, open(path + ".json", "w", encoding="utf-8"))
            time.sleep(2)
        out.append(path)
    return out


def ask(parts, model, k):
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}
    for attempt in range(4):
        r = requests.post(f"{video_critic.API}/v1beta/models/{model}:generateContent", params={"key": k},
                          json=body, timeout=600)
        if r.status_code == 200:
            text = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
            return json.loads(text[text.find("{"):text.rfind("}") + 1])
        print(f"{model}: {r.status_code} {r.text[:200]}", flush=True)
        time.sleep(20 * (attempt + 1))
    raise SystemExit("the critic did not answer")


COMPARE = """You are a senior 3D environment artist and sculptor reviewing two versions, A and B, of a junior's sculpt
for a documentary. The model is {era}

The director's standing rules: realism over stylisation; the body stylised only where the real one is; erosion
on the soft body beds, not the hard head; the paws rest on the floor; the bedding must read; nothing
showroom-clean.

Version A is shown first (a sheet in its material, then the same views in clay), then version B the same way,
then photographs of the real Great Sphinx for reference. Which version is the better asset, and by how much?
Score each out of 10 (10 = indistinguishable from photographed stone; 5 = obviously CG but acceptable;
3 = distracting). Then the most valuable changes to make to the better one, most valuable first.

Answer with JSON only:
{{"better": "A" or "B", "score_a": n, "score_b": n, "why": "two sentences",
"next": [{{"where": "...", "fix": "..."}}, ...]}}"""


def compare(a_dir, b_dir, era, model, k, runs=2):
    """Pairwise: is b_dir better than a_dir? Each run shows them in the other order, against a side bias.
    Returns the mean score of each and the runs."""
    out = []
    for n in range(runs):
        first, second = (a_dir, b_dir) if n % 2 == 0 else (b_dir, a_dir)
        parts = [{"text": COMPARE.format(era=ERAS[era])}]
        for label, d in (("A", first), ("B", second)):
            parts.append({"text": f"Version {label}:"})
            parts += [part(os.path.join(d, f)) for f in ("sheet-material.jpg", "sheet-clay.jpg")]
        parts.append({"text": "Reference photographs of the real Great Sphinx follow."})
        parts += [part(p) for p in photos()]
        res = ask(parts, model, k)
        flip = n % 2 == 1
        res["score_old"], res["score_new"] = (res["score_b"], res["score_a"]) if flip else (res["score_a"], res["score_b"])
        res["new_better"] = (res["better"] == "A") if flip else (res["better"] == "B")
        out.append(res)
        print(f"run {n}: old {res['score_old']} new {res['score_new']} new better: {res['new_better']}\n  {res.get('why')}", flush=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--era", required=True, choices=sorted(ERAS))
    ap.add_argument("--model", default="gemini-3.1-pro-preview")
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--against", help="an earlier candidate's folder: compare the two instead of scoring one")
    a = ap.parse_args()
    d = a.dir
    if a.against:
        res = compare(a.against, d, a.era, a.model, video_critic.key(), a.runs)
        json.dump(res, open(os.path.join(d, "compare-" + os.path.basename(os.path.dirname(os.path.normpath(a.against))) + ".json"),
                            "w", encoding="utf-8"), indent=1)
        wins = sum(r["new_better"] for r in res)
        print(f"new better in {wins} of {len(res)}; old {sum(r['score_old'] for r in res) / len(res):.2f}, new {sum(r['score_new'] for r in res) / len(res):.2f}")
        for nx in res[0].get("next", [])[:6]:
            print(f"  [{nx.get('where')}] {nx.get('fix')}")
        return
    imgs = [os.path.join(d, f) for f in ("sheet-material.jpg", "sheet-clay.jpg", "material-head.png", "material-beds.png")]
    imgs = [p for p in imgs if os.path.exists(p)]
    parts = [{"text": BRIEF.format(era=ERAS[a.era])}]
    parts += [part(p) for p in imgs]
    parts.append({"text": "Reference photographs of the real Great Sphinx follow."})
    parts += [part(p) for p in photos()]
    k = video_critic.key()
    runs = []
    for n in range(a.runs):
        res = ask(parts, a.model, k)
        json.dump(res, open(os.path.join(d, f"critic-{n}.json"), "w", encoding="utf-8"), indent=1)
        runs.append(res)
        print(f"run {n}: {res.get('score')} {json.dumps(res.get('subscores'))}\n  {res.get('verdict')}", flush=True)
    score = sum(float(r["score"]) for r in runs) / len(runs)
    json.dump({"era": a.era, "model": a.model, "score": round(score, 2), "runs": [r["score"] for r in runs]},
              open(os.path.join(d, "score.json"), "w", encoding="utf-8"), indent=1)
    print(f"mean {score:.2f}")
    for p in runs[0].get("problems", [])[:8]:
        print(f"  {p.get('rank')}. [{p.get('where')}] {p.get('what')}\n     fix: {p.get('fix')}")


if __name__ == "__main__":
    main()
