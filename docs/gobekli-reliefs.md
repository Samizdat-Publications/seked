# Göbekli Tepe: the pillars' reliefs

Stewart, 20 October 2026: the carvings are the site's central feature, after its existence, so Enclosure D is not
shown again without them. The reliefs are a look reconstruction from photographs and the excavators' drawings,
labelled as such on the stand-in; nothing about them enters `data/` as a measurement.

## How a face is made

1. **References**, per pillar and face: the excavators' drawing where one is published (it fixes the motifs and
   their places), and the straightest photographs (they give the depth and the character of the cutting).
2. **A height map** from Gemini's image model (`scripts/sphinx_lab/banana.py`), given the drawing and a
   photograph: orthographic, white raised motif, mid grey original surface, nothing invented where the drawing
   shows nothing. Checked side by side against the drawing.
3. **Cleaned** in code: the drawing's outline strokes and dashed break lines closed out, a short bevel by blur.
4. **Carved** onto the stand-in pillar's face as displacement in `render/enclosure_d.py`, the pillar found by its
   number on the excavators' plan (the stand-in's wall pillars are evenly spaced placeholders today and need the
   plan's numbering first).

## Pillars and references

Working copies of Stewart's references are in `build/gobekli/stewart/` (gitignored: most are all rights
reserved, so they are looked at, not republished). Sources:

| Pillar | Face | Reference | Source |
|---|---|---|---|
| 43, the Vulture Stone | front (south-east) | excavators' line drawing, beside a photograph | via Andrew Collins, https://www.andrewcollins.com/page/news/P43.htm |
| 43 | front | photograph with scale bar, early excavation | same page |
| 43 | front | photograph today, under the shelter | same page |
| 43 | front, the vulture | close-up | same page |
| 43 | the sky reading | the relief laid over Stellarium's sky for 9600 BCE (Cygnus as the vulture, Scorpius as the scorpion) | Collins; and Sweatman and Tsikritsis 2017, *Mediterranean Archaeology and Archaeometry* (open access) |
| 43 | | the DAI's account: "Of animals and a headless man" | https://www.dainst.blog/the-tepe-telegrams/2016/10/14/of-animals-and-a-headless-man-gobekli-tepe-pillar-43/ |
| 18 or 31 (central) | side: arm, hands, belt with fox pelt | photograph © Fazli Karabacak | Stewart, 20 October |
| Enclosure D | plan | schematic plan with pillar numbers (18, 19 to 22, 30 to 33, 38, 41 to 43) and the 350.5° axis | via Collins |

Still wanted: the central pillars 18 and 31 straight on (front, both sides, the belt and the H and crescent on the
collar), and pillars 27 (the predator in the round), 30, 33 and 38. The DAI's Tepe Telegrams blog has photographs
and drawings of every Enclosure D pillar.

## Progress

- 20 October: Pillar 43's front face, first height map (`build/gobekli/p43-height-a.png`, 1696 by 2528): every
  motif of the drawing in place, nothing invented. Next: clean the outline strokes and break lines, carve a test
  slab, then the plan's numbering in `enclosure_d.py`.

## For the exhibit

The Vulture Stone is a claim in its own right: Sweatman and Tsikritsis read it as a sky map dated by precession,
the vulture as Cygnus and the scorpion as Scorpius. `@seked/sky` can draw the sky over Göbekli Tepe for any date,
so the exhibit can lay the relief over the computed sky in chapter 7, as chapter 5 does with Orion, with the
claim, its free choices and the reply.
