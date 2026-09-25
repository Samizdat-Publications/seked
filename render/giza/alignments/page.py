"""
apps/alignments/: the finished pictures as web JPEGs and a page that shows them in order.

    python render/alignments.py page

Reads build/alignments/<picture>.png (the finals of `overlay --final`) and writes
apps/alignments/img/<picture>.jpg and a draft page, apps/alignments/draft.html. It deploys nothing.
"""
import html
import io
import os

from PIL import Image

from .compose import OUT
from .project import REPO

APP = os.path.join(REPO, "apps", "alignments")

# The pictures in reading order, each with the sentence that introduces it on the page.
PICTURES = [
    ("c4-orion-night", "Orion over Giza, 10,450 BCE",
     "The night the lost-civilisation reading calls the First Time: Orion's belt at the lowest point of its precessional "
     "swing, hanging over the three pyramids in their order."),
    ("c4-orion-plan", "The belt on the ground",
     "The same three stars laid on the plan and fitted to the pyramids, with the belt's angle through 15,000 years of "
     "precession."),
    ("c5-leo-dawn-10500", "The lion faces Leo, 10,500 BCE",
     "The spring equinox dawn behind the lion Sphinx: Leo lies along the horizon and the sun is about to rise beneath it."),
    ("c5-taurus-dawn-2500", "The Bull, not the Lion, 2500 BCE",
     "The same place and moment 8,000 years later: the equinox sun rises in Taurus and Leo is nowhere near."),
    ("c2-shafts-2450", "Where the shafts point, 2450 BCE",
     "The Great Pyramid seen through, its four shafts carried out to Alnitak, Sirius, Thuban and Kochab at their "
     "culminations."),
    ("c2-shafts-10450", "The shafts in 10,450 BCE",
     "The same shafts under the sky of the First Time, and what crossed their lines then."),
]


def build():
    os.makedirs(os.path.join(APP, "img"), exist_ok=True)
    figures = []
    for name, title, lead in PICTURES:
        png = os.path.join(OUT, f"{name}.png")
        if not os.path.exists(png):
            print(f"{name}: no final at {png}; left out")
            continue
        jpg = os.path.join(APP, "img", f"{name}.jpg")
        Image.open(png).convert("RGB").save(jpg, quality=86, optimize=True, progressive=True)
        print(f"  {name}.jpg: {os.path.getsize(jpg) / 1e6:.2f} MB")
        figures.append(f"""  <figure>
    <a href="img/{name}.jpg"><img src="img/{name}.jpg" alt="{html.escape(title)}: {html.escape(lead)}" loading="lazy" width="1920" height="1080"></a>
    <figcaption><strong>{html.escape(title)}.</strong> {html.escape(lead)}</figcaption>
  </figure>""")
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sky Alignments</title>
<meta name="description" content="Orion, Leo and the Great Pyramid's shafts drawn as the lost-civilisation reading's strongest case, every star from the Seked sky engine.">
<style>
  :root {{ --bg: #0b0e16; --ink: #ece8de; --muted: #b8b2a4; --gold: #f2c978; --rule: #262b38; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.55 "Segoe UI", system-ui, sans-serif; }}
  main {{ max-width: 1240px; margin: 0 auto; padding: 40px 16px 64px; }}
  h1 {{ font: 400 clamp(28px, 4vw, 44px)/1.15 Georgia, serif; margin: 0 0 12px; }}
  .lead {{ color: var(--muted); max-width: 760px; margin: 0 0 36px; }}
  figure {{ margin: 0 0 44px; }}
  img {{ display: block; width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--rule); }}
  figcaption {{ color: var(--muted); margin-top: 10px; max-width: 860px; }}
  figcaption strong {{ color: var(--gold); font-weight: 600; }}
  footer {{ color: var(--muted); font-size: 14px; border-top: 1px solid var(--rule); padding-top: 18px; }}
</style>
</head>
<body>
<main>
  <h1>The sky alignments, drawn as their strongest case</h1>
  <p class="lead">Three claims of the lost-civilisation reading (Bauval, Hancock), each pictured as persuasively as it can
  honestly be: Orion's belt over the pyramids, the lion Sphinx facing Leo, the shafts reaching for their stars. Every star
  is where the Seked sky engine puts it (Vondr&aacute;k 2011 precession, the HYG 4.2 catalogue); every number is the
  claims engine's own. Where a match is loose, the picture says by how much.</p>
{chr(10).join(figures)}
  <footer>Renders: Blender Cycles, render/alignments.py. Stars: HYG 4.2 (CC BY-SA 4.0). Constellation figures: Stellarium's
  modern sky culture (CC BY-SA 4.0). The First Time and lion eras are the claim, not a reconstruction; the Sphinx is a
  stand-in model.</footer>
</main>
</body>
</html>
"""
    # The published page (apps/alignments/index.html) is written by hand in the walkthrough's design, with
    # each picture's numbers and looseness in its caption; this draft goes beside it for reference only.
    with io.open(os.path.join(APP, "draft.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(doc)
    print(f"wrote {os.path.join(APP, 'draft.html')}: {len(figures)} pictures (the page itself is apps/alignments/index.html)")
