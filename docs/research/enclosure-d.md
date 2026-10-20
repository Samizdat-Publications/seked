# Enclosure D: what a stand-in can be built from

*Written by the night builder on 20 October 2026 (chunk 7, item 19), for chapter 7's beat "a monument appears on a
hilltop in south-east Turkey" and the plan's phase 8. Read against the sources named; nothing here is from memory.*

## The answer

**The plan's first route holds: a stand-in built from a published plan, with its heights from print.** One
open-access, peer-reviewed paper carries both: Haklay & Gopher 2020 (`haklay-gopher-2020`), whose p. 347 gives
Enclosure D's figures and whose Fig. 1 (p. 344) is a schematic plan of the main excavation area with a 5 m scale bar
and a north arrow. The plan gives the ring and where each pillar stands; the text gives how big it is and how tall.
The pillars' form (the T, the arms and belts, the fox) is then a modelling choice from photographs, labelled as such,
and nothing about it is entered as a measurement.

## What is printed (in `data/measurements/gobekli.json`, verified against the PDF's p. 347)

| Key | Value | The paper's words |
|---|---|---|
| `gobekli.enclosure_d.diameter.inner.max` | 14 m | "The maximum inner diameter of this enclosure is about 14 m" |
| `gobekli.enclosure_d.wall.height.preserved.min` | 3 m | "preserved to an elevation of over 3 m" |
| `gobekli.enclosure_d.pillars.peripheral.count` | 11 | "connects (so far) 11 T-shaped pillars" |
| `gobekli.enclosure_d.pillars.central.count` | 2 | "the twin central pillars" |
| `gobekli.enclosure_d.pillars.central.height` | 5.5 m | "rising to a height of 5.5 m" |
| `gobekli.enclosure_d.pillars.central.pedestal.height.min`, `.max` | 0.20, 0.30 m | "shallow pedestals ... (20–30 cm high)" |

Also on p. 344, for the Layer III enclosures in general: peripheral pillars "3–4 m high", enclosures "10–30 m in
diameter", "possibly partially subterranean and roofed". Not entered: they are not Enclosure D's own.

The site, `gobekli-tepe` in `data/sites.json`, has UNESCO's point and an elevation sampled from GLO-30 there (776 m, a
surface model on the mound's top). The enclosure is `gobekli.enclosure-d`, tier `excavated`.

## The plan, Fig. 1

- Schematic, "modified from O. Dietrich et al. 2014", embedded in the PDF at 485 by 672 px (150 ppi). The scale bar
  is 5 m; at that resolution a pixel is roughly 0.15 m, so a position scaled off it carries a sigma of a few tenths of
  a metre once the drafting of a schematic plan is added. That is good enough for where the pillars stand in a ring 14
  m across; it is not good enough for anything a claim would rest on.
- It shows Enclosure D's wall, its two central pillars and the peripheral pillars as bars, which can be read with
  `scripts/plate.py` (`scale` on the bar, `register`, then `measure`), each figure `method: "scaled from plate"`,
  never verified.
- Piesker 2014, fig. 8 (redrawn as Haklay & Gopher's Fig. 4) is a detailed plan, of Enclosure C. A detailed plan of D
  would be better than the schematic; the DAI's publications (Piesker 2014; O. Dietrich et al. 2014) are the places
  to look, and their rights are unknown.

## Rights

The paper is CC BY-NC-ND 4.0 (Crossref's licence record). It may be shared unaltered, with attribution, for
non-commercial use; no adaptations. So the figure is read in `build/` and not committed or put on the page until
Stewart says whether Seked counts as non-commercial (night list, decision 70). The figures read off it are
measurements with a citation, which the licence does not restrict.

## Photographs

The pillars' form needs photographs. Wikimedia Commons has many of Göbekli Tepe under CC BY-SA, but its API does not
answer from the cloud container, so none was chosen tonight. Choose them on the laptop, record each in a manifest
with its licence, and keep the model's carving to what they show.

## Next (night list, item 19b)

1. Read Fig. 1 two ways: the scale bar, then the centre and the inner wall's outline, the two central pillars, and
   each peripheral pillar's position and bearing, into `data/measurements/gobekli.json` as `scaled from plate`.
2. A bpy-free module in `render/giza/` that builds the ring from those records (pillar sizes from the print, the T's
   proportions a stated look choice), tested; then a Blender still at eye height with a human figure for scale,
   labelled a stand-in, and looked at.
