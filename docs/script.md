<!-- The first draft, from `python scripts/research.py draft`: claude-opus-5-5 at xhigh effort, 31 turns, $5.66 on the API key, ended 2026-10-20T03:20:33+00:00. Edited by hand from here on; its sources are the briefs in docs/research/. -->

# Seked: the script

*First draft, 20 October 2026, edited the same day (the edits are listed at the end). It is built from `docs/research/ch1.md` to `ch8.md` (chapter 8's brief is now chapter 9's), `khafre-sar.md` and `labyrinth.md` for the new chapter 8, the claims in `data/claims/` and `docs/dossier.md` (generated 2 October; regenerate it before the receipts are wired). In the source lists, "(new)" marks an id that a brief proposed and checked, and "(new, unchecked)" marks one the brief did not check. Ids without a mark are already in `data/sources.json`.*

---

## 0. Cold open

**Narration** (113 words)

This is Giza at dawn, from the rooftops of Nazlet el-Samman. The Sphinx faces the sunrise, as it has for at least four and a half thousand years. Behind it stand the pyramids of Khufu and Khafre.

The textbooks say Khafre's workmen carved the Sphinx about 2500 BCE. Graham Hancock and Robert Bauval say the Sphinx and the plan of this plateau go back to about 10,500 BCE. Robert Schoch, a geologist, says the rock agrees with them.

So how old is the Sphinx? This piece makes their case as strongly as it can be made, and gives the archaeologists their answer. It starts where Schoch did, with the walls of the ditch.

**Beats**

- "This is Giza at dawn" → **sequence**, the new cold-open rise (about 120 frames): the `today` era, june-dawn lighting, the city from `data/footprints/city.*`. Over frames 0 to 60 the scroll lifts the camera from street level up over the roofs of Nazlet el-Samman.
- "The Sphinx faces the sunrise" → frames 60 to 100: the camera settles on the `sphinx-face` station, and first light reaches the face.
- "Behind it stand the pyramids of Khufu and Khafre." → frames 100 to 120: a slow push past the head until G1 and G2 fill the background. Small labels fade in.
- "carved the Sphinx about 2500 BCE" → a thin timeline appears along the foot of the stage, with 2026 at the right and a marker at 2500 BCE labelled "conventional".
- "go back to about 10,500 BCE" → the scroll stretches the timeline leftwards to a second marker at 10,500 BCE, labelled "claim". The 2500 BCE marker slides towards the right edge.
- "So how old is the Sphinx?" → hold. The timeline dims.
- "with the walls of the ditch" → the camera drops into the enclosure and holds on its west wall, which is the first frame of chapter 1.

**Receipts**

- None. The two markers are labels, not receipts: 2500 BCE is the conventional date (`lehner-hawass-2017`) and 10,500 BCE is the claim (`hancock-bauval-1996`).

**The reply**

Egyptologists date the Sphinx to Khafre's reign, in the middle of the third millennium BCE, and they read that date from the ground the Sphinx stands in rather than from its face. Its ditch is a quarry. The blocks cut from it built the temple at its paws, and that temple was built after Khafre's Valley Temple, on its enclosure wall. The quarry's southern edge forms the side of Khafre's causeway. None of the physical dates taken at Giza, by radiocarbon or by luminescence, comes anywhere near 10,500 BCE. Colin Reader, a geologist who argues for an earlier Sphinx, puts it only a few centuries before Khufu. Each chapter that follows sets one part of this answer beside the claim it meets.

**Spoken reply**: Archaeologists answer that the Sphinx was cut from Khafre's quarry about 2500 BCE, and each chapter sets their reasons beside the claim.

**Sources**: `lehner-hawass-2017`, `hancock-bauval-1996`, `dobecki-schoch-1992`, `open-buildings-v3`, `open-buildings-25d-temporal`, `aera-sequence` (new), `reader-2026` (new; checked only through reviews), `liritzis-vafiadou-2015` (new), `bonani-2001` (new)

---

## 1. Older than it should be

**Narration** (219 words)

The Sphinx was not built. It was carved, by cutting a ditch around a knoll of bedrock, so the walls of the ditch are as old as the statue.

Robert Schoch, a geologist, looked at these walls in the early 1990s and saw rain. The profile rolls. Harder beds stand out and softer beds are cut back into deep coves. Vertical fissures open widest at the top, where water off the plateau would run in. Wind and blown sand, he says, cut sharp level grooves instead, like those on the Old Kingdom tombs nearby. Even Colin Reader, a geologist who rejects Schoch's date, agrees that running water cut these walls.

Then Schoch looked under the floor. In a seismic survey published in 1992, he and a colleague sent sound through the rock. By his account, the stone in front of the Sphinx and along its sides is weathered about two metres deep, and behind it only a little over one. Deeper weathering means longer exposure, he argues, so the front was cut long before the back.

On his most cautious reckoning, the core of the Sphinx is at least seven thousand years old. His own view now is the end of the last Ice Age, about 10,000 BCE.

If the body is that old, look again at the head.

**Beats**

- "The Sphinx was not built." → **sequence**, new: the enclosure wall through the master Sphinx's subtracted eras, 96 frames. It opens on the west wall of the ditch in the `today` era, lit by a low morning sun. The stage holds still while the first paragraph scrolls past.
- "so the walls of the ditch are as old as the statue" → a plan inset (live SVG) draws the ditch round the body from `sphinx.enclosure.margin.north` (14.12 ± 0.57 m) and `.west` (4.19 ± 0.70 m), captioned "scaled from ARCE drawing d-gen-008, unverified".
- "The profile rolls." → live SVG traces the bedding on the wall: ridges on the hard beds, coves in the soft ones. Each bed's hardness is labelled as sourced, or as a stated look choice where no source gives it.
- "Vertical fissures open widest at the top" → the fissures are highlighted, with small arrows for run-off coming in from the top.
- "Wind and blown sand, he says, cut sharp level grooves instead" → the stage splits. A licensed photograph of a wind-scoured Old Kingdom tomb face (a new asset, still to be found) sits beside the wall at the same scale, captioned "Schoch's comparison".
- "Then Schoch looked under the floor." → the ditch floor turns translucent. Seismic lines S1 to S4 and S9 are drawn on it, placed from Reader's Fig. 5 until the paper's own figures are read, and labelled as such.
- "behind it only a little over one" → the weathered zone appears as a translucent slab under the floor, about 1.8 to 2.5 m deep in front and along the flanks and about 1.2 m behind the rump, labelled "by Schoch's account, unverified".
- "so the front was cut long before the back" → the scroll now runs the eras backwards on the same wall. Frames 0 to 48 go from `today` to the long rains (`lion`, c. 7000 BCE): the coves get shallower and the fissures narrow. Frames 48 to 96 go on to the fresh cut (`first-time`, c. 10,500 BCE) with crisp arrises. A clock strip under the stage keeps step, over a green-Sahara band from `kuper-kropelin-2006`: humid from c. 8500 BCE, drying from 5300 BCE.
- "about 10,000 BCE" → hold on the fresh-cut wall, with the corner label "a claim state".
- "look again at the head" → the camera tilts up the flank to the head. **Look around**: the `sphinx-flank` panorama in the `lion` era.

**Receipts**

- **W1, "the date from depth of weathering"** (proposed; there is no claim yet).
  - **Inputs:** one weathering depth per seismic line from `dobecki-schoch-1992`, with `method: "seismic refraction"` and `verified: false` until read from the paper's own figures. Proposed keys are `sphinx.enclosure.weathering.depth.s1` to `.s4` and `sphinx_temple.floor.weathering.depth.s9`. The *KMT* figures (S3 about 1.2 m; S1, S2 and S4 1.8 to 2.5 m) stay in the notes until then.
  - **Formula:** t_front = t_rear × (d_front / d_rear)^n.
  - **Free choices (2):** when the rear was first exposed (Khafre, c. 2500 BCE, `lehner-hawass-2017`), and the exponent n. With n = 1, weathering grows in a straight line with time, which is Schoch's "conservative" reading. With n = 2, the weathering front slows as the square root of time.
  - **What the reader sees:** the brief's arithmetic below, counted from the 1991 survey, until the engine computes it.

    | Front : rear | n = 1 | n = 2 |
    |---|---|---|
    | 1.5 (1.8 / 1.2 m) | c. 4,750 BCE | c. 8,100 BCE |
    | 2.08 (2.5 / 1.2 m) | c. 7,360 BCE | c. 17,500 BCE |
    | 3.33 (S4, about 4 m / 1.2 m) | c. 13,000 BCE | c. 48,000 BCE |

  - **What it says:** with n = 1 the table reproduces Schoch's 7000 to 5000 BCE. The spread across n shows that the date is set more by the free choices than by the depths. There is no target, so there is no residual. The climate band is drawn behind it for context.
- **Already in the database:** `sphinx.enclosure.margin.west` is about a third of `.north`. The ditch is narrowest behind the rump, which is where Schoch puts the later, Khafre-era cut and where line S3 is shallowest.

**The reply**

The strongest answer is the order of building. The Sphinx Temple's core blocks match the lower beds of the Sphinx ditch, layer for layer. The temple was built on the enclosure wall of Khafre's Valley Temple, and the quarry's southern edge forms the side of Khafre's causeway. AERA, Mark Lehner's research group, puts the Sphinx "late in the sequence" of Khafre's works. That dates the last quarrying, but not necessarily the first cut. On the wear itself, Gauri and colleagues argue in the same journal as the seismic survey that the channels are ancient karst opened up by the digging, and that a dry climate can round soft beds. Harrell suggests the seismic contrast may be the rock's original layering, and Lehner notes that the lowest bed thins from the rump to the paws. Reader accepts that rain did it but puts the rain in the early dynasties. Nobody has drilled the floor to test either reading.

**Spoken reply**: Archaeologists answer that the ditch was quarried for Khafre's temples, and geologists that old karst and the rock's own layers can explain the wear, though no one has yet drilled the floor to test either reading.

**Sources**: `dobecki-schoch-1992`, `arce-sphinx-mapping-oc`, `arce-sphinx-1991`, `lehner-hawass-2017`, `schoch-sphinx-web` (new), `schoch-1992-kmt` (new, unchecked), `reader-giza-before-4th` (new), `reader-2001` (new), `gauri-1995` (new), `harrell-1994` (new), `lehner-1994-kmt` (new), `aera-sequence` (new), `kuper-kropelin-2006` (new; abstract only)

---

## 2. A lion, not a king

**Narration** (219 words)

Look at the head. It wears the striped headcloth of a Fourth Dynasty king, and it is better kept than the body below it. Beside that long body it is too small. Nobody disputes either point.

Hancock, Bauval and Schoch read the two facts as one story. The figure was a lion first. It stood through the long rains, and its head wore away. When a king of the pyramid age took it over, his sculptors cut a royal face into what was left. You can only carve a smaller form inside a larger one, so the new head came out small. Here the king's head sits inside the lion's, and the ghost around it is the stone they cut away. Even Colin Reader, who dates the Sphinx far later than they do, argued in 2026 that it began as a lion.

At the spring equinox the sun rises close to due east in every age, so the Sphinx's eastward gaze alone dates nothing. But the stars behind the sunrise drift. In about 10,500 BCE, Hancock and Bauval calculate, the constellation of the Lion rose in the east just before the equinox sun. The lion on the ground watched its own image come up.

If the lion is that old, they argue, so are the temples at its feet.

**Beats**

- "Look at the head." → **sequence**, new: the ghosted head, 72 frames. It opens at the `sphinx-face` station on the master Sphinx's c. 2500 BCE state, the king's head in raking light.
- "Beside that long body it is too small." → the camera pulls back to a side elevation. Head and body are outlined, captioned "stand-in mesh scaled to `sphinx.length`, `.height` and `.width`, not a measurement".
- "The figure was a lion first." → the scroll runs the master back to phase I (c. 10,500 BCE, the fresh lion head) and then forward to phase II (c. 7000 BCE, weathered).
- "Here the king's head sits inside the lion's" → the hero image: phase III with the weathered lion head ghosted around the nemes. The scroll fades the ghost from 100 to 25 per cent opacity. The Member III band is tinted faintly; the reply uses it.
- "At the spring equinox the sun rises close to due east in every age" → **live sky** over the Sphinx's back looking east, at epoch 2026 on the equinox. C5's `sun-ribbon` draws the "due east" and "equinox sunrise" bearings.
- "But the stars behind the sunrise drift." → the scroll drives the epoch from 2026 to −10499 (`@seked/sky`, Vondrák 2011), and the stars wheel. Leo's figure lines are drawn with the caption "a modern figure".
- "rose in the east just before the equinox sun" → hold at −10499, about fifty minutes before sunrise. The "Regulus rising" bearing is drawn about 10° to the right of due east, so the gap is visible, and the C5 receipt opens.
- "so are the temples at its feet" → the camera lowers to the Sphinx Temple at the paws. **Look around**: the `sphinx-face` panorama.

**Receipts**

- **C5, Sphinx and Leo**, at epoch −10499.
  - Regulus's rising azimuth is 100°14′04″ against due east: a residual of 10°14′04″, twice the ±5° band. **Does not hold.**
  - Regulus rose −12°33′53″ of sidereal time ahead of the equinox sun, about fifty minutes, inside the ±30° band. **Holds.**
  - Free choices (3): the epoch; Regulus standing for the whole of Leo; and due east as the gaze, because no surveyed axis for the Sphinx is in the database.
  - Shown as: Leo did rise just before the sun, but it did not rise due east. Overall, the claim is not within tolerance.
- **D4, Sphinx axis and the temples.** The Sphinx Temple's east wall is −1.2′ from the meridian (band ±15′), its north wall +22.0′ from due east (band ±30′), and the Valley Temple's mean axis +5.0′. All hold. Free choice (1): the temple's axis stands in for the Sphinx's own.
- **C6, Solstice akhet** (shown in the reply). Seen from the Sphinx at epoch −2499, the summer-solstice sun sets in the gap between Khufu's and Khafre's pyramids: +2°38′15″ against a band of ±8°, with no free choices. **Holds.** This is Lehner's alignment, which the reply relies on.
- **H1, "the head inside the lion"** (computed 20 October by `render/giza/sphinx_eras.py`, not yet a claim file). On the master lion as Meshy drew it, the largest king's head that fits wholly inside the weathered lion's head is 3.39 m chin to crown where the lion's stood, or 5.27 m set 1.47 m back and 2.02 m down, against the monument's **5.73 ± 0.09 m** (`sphinx.head.height`, scaled off ARCE's south elevation, unverified): on the lion as drawn, the claim's carving cannot make the head the Sphinx has. So the model enlarges the lion's head and mane about the head's foot, by the least factor at which the monument's own head, at its own size and with its crown at the monument's height, lies wholly inside: **1.16 times** (`--solve-head`; the renders use 1.17, a stated look choice). That factor is the receipt: on these stand-ins, the story works only if the lion's head was about a sixth larger than the one drawn from the photographs. It is read off two stand-ins, the master lion and the king's head, and the receipt says so. `docs/claims-proposed.md` has the proposal.
  - **Inputs:** the master lion, a Meshy stand-in, scaled to `sphinx.length` 73.0 m, `sphinx.height` 20.2 m and `sphinx.width` 19.1 m (`arce-sphinx-1991`, unverified); the phase II weathering; a nemes head.
  - **Free choices:** the master mesh, how deep the long rains wore, and the nemes head's natural proportions (taken from which royal sphinx).
  - **Output:** the factor the lion's head had to be enlarged by for the monument's head to fit inside it, with the fits on the lion as drawn beside it. The stand-in caveat is shown on screen.
- **Proposed data:**
  - Head and body proportions (`sphinx.head.height`, `sphinx.face.width`, `sphinx.head.length`) scaled from the ARCE elevations, with the standard of comparison stated as a free choice.
  - The Sphinx's own axis, scaled from d-gen-008, to replace "due east".
  - The epochs at which the vernal point crossed Leo's IAU boundaries (`iau-boundaries` imported into `data/stars/`, with Vondrák precession). The brief's constant-rate estimate (Virgo into Leo c. 10,400 BCE) is not shown until the engine computes it.

**The reply**

Egyptology's case for Khafre rests on the ground, not on the face. Peter Lacovara's 2026 review of Reader's book sets it out: the Sphinx Temple is built of blocks cut from the Sphinx ditch, the temple was left unfinished, nothing near the Sphinx is older than the Fourth Dynasty, and the paws had to be finished in masonry, as they would be if a remnant of rock were being made into a figure. The head is small and well kept because of the rock it is in. The body is cut through alternating hard and soft beds, while the neck and head lie in a higher bed, "softer at the neck and harder at the head". In a 2023 flume experiment, flowing water wore a clay mound with a hard core into a lion-like shape. And the zodiac's Lion is a Mesopotamian figure; the Egyptian zodiacs that show it, such as Dendera's of about 50 BCE, are late. Seked's own model makes a smaller point of its own: the lion drawn from the photographs could not hold the head the Sphinx has, and its head had to be enlarged by a sixth before the claim's carving would work.

**Spoken reply**: Egyptologists answer that the head is small because it was cut from a harder band of rock, and that the Sphinx belongs with Khafre's quarry, his temples and their own alignments to the sun.

**Sources**: `hancock-bauval-1996`, `hancock-1995`, `krupp-1997`, `vondrak-2011`, `hyg-4.2`, `nell-ruggles-2014`, `lehner-1997`, `lehner-hawass-2017`, `arce-sphinx-1991`, `arce-sphinx-mapping-oc`, `coords-sphinx-cited`, `schoch-bauval-2017` (new; publisher's page only), `reader-2026` (new; checked through Lacovara's review), `lacovara-2026` (new), `aera-sphinx-geology` (new), `boury-2023` (new), `rogers-1998` (new), `aubourg-1995` (new; listing only), `iau-boundaries` (new, unchecked)

---

## 3. Temples of the same stone

**Narration** (218 words)

At the Sphinx's paws stand two temples. One of them, the Valley Temple, is lined with red granite from Aswan. Behind the granite is a core of local limestone, in blocks that Flinders Petrie found ranging in weight to over a hundred tons each.

Those blocks came out of the Sphinx's own ditch, layer by layer. On that, the archaeologists and their critics agree. The temples are built of the lion's stone, cut as the lion was freed from the rock.

Schoch and the writer John Anthony West went further. On camera in 1993, they said the limestone behind the granite is rounded and fissured like the ditch walls, and that the backs of the granite blocks were cut to fit that worn surface. Schoch writes that the core blocks of both temples carry the weathering of heavy rain beneath their Old Kingdom granite. Nobody weathers a wall and then cases it. On this reading the granite is a refit, laid over a building that was already old.

Hancock argues that the temple is credited to Khafre "on no good grounds whatsoever". Khafre's statues, found inside it, and its granite show that he used and refaced the building. They leave the age of its core open.

And the Egyptians' own records put long ages before their first king.

**Beats**

- "At the Sphinx's paws stand two temples." → **stills**: the `sphinx` shot (the Sphinx with Khafre's pyramid behind, from above the temples) in the `today` era. The scroll crossfades it to the `built` era.
- "Behind the granite is a core of local limestone" → **sequence**, new, from the `valley-hall` shot: the scroll lifts the granite casing away block by block to show the megalithic core (`temple_mode` megalithic).
- "Those blocks came out of the Sphinx's own ditch, layer by layer." → **sequence**, new, from above: the core blocks fly back to the beds of the enclosure they were cut from, with the ditch's beds banded in colour. The flight paths are schematic until the block typing is data, and are captioned "after AERA's description".
- "On camera in 1993" → **live SVG over a still**: the joint peeled open. One Valley Temple wall is shown in section, with the granite pulled forward, a rounded and fissured core behind it, and the back of the granite shaped to that profile. Caption: "the claim as West and Schoch describe it, not a survey".
- "On this reading the granite is a refit" → the scroll crossfades the `lion`-era temple (megalithic-weathered) into the `built`-era temple, so that the granite closes over the worn core.
- "Khafre's statues, found inside it" → a plate of the enthroned Khafre (CG 14), from a licensed photograph, set in the vestibule. The statue sockets (`khafre_valley_temple.hall.socket.pitch`, `.socket.first.east`) are drawn on the hall floor.
- "long ages before their first king" → fade to night. **Look around**: the `valley-temple` panorama.

**Receipts**

- **D4** as in chapter 2: the temples' walls are cardinal to within a few arcminutes, and all three comparisons hold. The passage between the temples (+4°33′, `sphinx_temple.wall.south.passage.dfc`) and Khafre's causeway (+13°26′) are drawn too but not counted, because they were never meant to be cardinal.
- **The pillar check** (data only, not yet a claim). `khafre_valley_temple.pillar.across` is 1.01 ± 0.19 m, scaled from Hölscher's Blatt XVII. Against Petrie's 41 inches (1.041 m, §96, still to be entered from `petrie-1883`) the residual is 0.03 m, inside sigma. Given a sourced granite density, the engine would return Petrie's "about 13 tons" (1.041² × 4.425 m × 2.7 t/m³ ≈ 12.9 t). That is arithmetic for now, because no density key exists.
- **T1, "the hundred-ton block"** (proposed).
  - **Formula:** mass = l × w × h × ρ.
  - **Inputs:** block outlines scaled, with their sigma, from the ARCE plans d-st-027, d-kvt-007 and d-gen-048 (`arce-sphinx-mapping-oc`); course heights from Ricke; a sourced `limestone.giza.density`.
  - **Free choices:** which block, and the density.
  - Until it exists, "a hundred tons" is shown as Petrie's estimate, not as a measurement.
- **Petrie's skew** (proposed). `khafre_valley_temple.passage.causeway.azimuth`, scaled from Blatt XVII, against `khafre_causeway.edge.north.azimuth` (103°26′, `nell-ruggles-2014`). If the angles match, "built for this causeway" becomes a residual.
- **Luminescence dates as records** (proposed), from `liritzis-vafiadou-2015` Table 1: Valley Temple granite VT1 3060 ± 470 BCE; Valley Temple limestone VT9a 1050 ± 540 BCE; Sphinx Temple limestone ST2 2220 ± 220 BCE.
- No precession receipt belongs to this chapter.

**The reply**

Archaeologists read the order of building in the walls. The Valley Temple came first: its enclosure wall respects its finished granite casing. The Sphinx Temple was then built on that wall's foundation and left without its outer granite, so on its outside there is no granite over weathered stone at all. Petrie showed in 1883 that the Valley Temple's passage was built skewed to meet Khafre's causeway. Mark Lehner answers the joint directly. Where granite has been removed, the limestone surface the masons cut to receive it survives, and the exposed cores have weathered only since Hölscher cleared them early in the twentieth century. At Menkaure's unfinished temple, core and casing went up together. A limestone block at the base of the Sphinx Temple's wall gives a luminescence date of 2220 ± 220 BCE. Neither side has published a measured section through an original joint.

**Spoken reply**: Archaeologists answer that core and casing went up together, as at Menkaure's unfinished temple, and that the Sphinx Temple never received its outer granite at all.

**Sources**: `petrie-1883`, `hoelscher-1912`, `reisner-1931`, `nell-ruggles-2014`, `arce-sphinx-mapping-oc`, `arce-sphinx-1991`, `lehner-hawass-2017`, `hancock-1995`, `schoch-sphinx-web` (new), `west-1993-film` (new, unchecked; known only as quoted in `lehner-1994-kmt`), `lehner-1994-kmt` (new), `lehner-2017-aeragram` (new), `aera-khafre-monuments` (new), `hancock-fridman-2024` (new), `liritzis-vafiadou-2015` (new), `ricke-1970` (new, unchecked), `khafre-enthroned-cg14` (new, unchecked)

---

## 4. The First Time

**Narration** (219 words)

Egypt did not think it began with its first king. A papyrus in Turin, copied about 1250 BCE, lists the kings back to Menes, and before him gods, then spirits, then the Followers of Horus. In the most probable reading of its damaged numbers, it gives the spirits and Followers 13,420 years and, in the next line, 23,200. Manetho, a thousand years later, tells the same story.

The Egyptians called the beginning sep tepi, the First Time. Hancock and Bauval read it as a memory, not a myth: a golden age, they write, that immediately followed creation.

Here is the plateau as they picture it. The lion and its two temples stand alone. Where the pyramids will rise, nothing stands yet.

A stela found beside the Great Pyramid says Khufu found a house of Isis "beside the house of the Sphinx". If that is true, they argue, the Sphinx was there before Khafre.

On the walls of King Unas's burial chambers at Saqqara, carved about 2400 BCE, the oldest copy of the Pyramid Texts sends the king into the sky. "Unas appears as a star." "Orion is encircled by the Duat," it says, and so are Sothis, the star we call Sirius, and Unas.

None of these texts gives a date. Hancock and Bauval look for one in the sky.

**Beats**

- "Egypt did not think it began with its first king." → **stills**: the First Time at night, rebuilt with no pyramids (`first-time` state). The sky is cut out, and the live sky at −10499 puts Orion high in the south.
- "A papyrus in Turin" → a plate of the Turin Canon fragment, column II, from a licensed photograph, laid over the stage. Restored signs are shown in lighter ink.
- "13,420 years and, in the next line, 23,200" → the two numerals light up with their "+ x" marks. A timeline unrolls leftwards from Aha's accession (median 3085 BCE, `dee-2013`), driven by the scroll. Two markers are set on it: 13,420 years alone, and the two figures summed (Schwaller's sum, not a figure on the papyrus). A thin line marks 10,500 BCE for reference.
- "Here is the plateau as they picture it." → the plates clear to the First Time wide shot. C4's belt is drawn faintly on the ground by the page; the render invents no monument, and the grass grows over the sites. Corner label: "a claim state".
- "A stela found beside the Great Pyramid" → a plate of the Inventory Stela, from a licensed photograph, with its line picked out. The plate then slides down to sit beside the Sphinx in its ditch.
- "On the walls of King Unas's burial chambers at Saqqara" → a plate of Unas's sarcophagus chamber, south wall, from a licensed photograph, with PT 216 §151 highlighted.
- "the star we call Sirius" → the plate dissolves into the live sky over Saqqara at epoch −2399, with Orion and Sirius in the south, labelled Sah and Sothis.
- "Hancock and Bauval look for one in the sky." → the sky slider's handle appears at the foot of the stage, set to −2399, leading into chapter 5.

**Receipts**

- **Dates only.**
- **King-list totals as records** (proposed, `data/texts/kinglists.json`). Each total carries its "+ x" flag and its reading uncertainty. This is a new unit, so `CLAUDE.md` needs a sentence for it. Anchored on Aha's accession at a median of 3085 BCE (`dee-2013`), the brief's arithmetic gives:
  - Turin, 13,420 years alone: c. 16,500 BCE.
  - Turin, 13,420 plus 23,200 summed: c. 39,700 BCE.
  - Eusebius's Manetho: 24,900 "lunar years", which Eusebius himself turns into 2,206 solar years.
  - None lands on 10,500 BCE. The lists say "very old", not "10,500".
- **Radiocarbon bands** (proposed records, 95% ranges):
  - Aha: 3218–3035 BCE (`dee-2013`).
  - From `bronk-ramsey-2010` Table 1: Djoser 2691–2625, Khufu 2629–2558, Khafre 2604–2528, Unas 2450–2363 BCE. Khufu, Khafre and Unas are modelled from reign lengths, not dated directly.
- **"The sky the Pyramid Texts saw"** (proposed, data only): `star.alnitak.transit.altitude` and `star.sirius.transit.altitude` at epoch −2399 over Saqqara, which has to be added to `data/sites.json`. It is an overlay with no target.
- **Proposed code:** the heliacal rising of Sirius (an arcus-visionis function in `packages/sky`), for PT 302's "Sothis lives".
- C2, in chapter 5, ties the Great Pyramid's shafts to the same century's sky.

**The reply**

Every one of these texts was written long after the time it describes, and none carries a date. The Turin papyrus is some 1,850 years younger than Menes, and its oldest numbers are partly restored. Manetho's totals differ from one later copyist to the next, and Eusebius, who preserved one version, already turned his years into months. James Breasted, who translated the Inventory Stela, called the evidence of its late date "entirely conclusive". A 2022 study reads the First Time as a pattern renewed in each coronation and temple foundation, not as an era that can be dated. The star religion of the Pyramid Texts is real, and the Great Pyramid's shafts point at Orion's belt and Sirius in the century the pyramids were built. Radiocarbon, which depends on none of these texts, dates Egypt's first king to about 3100 BCE and runs unbroken from there to Khufu.

**Spoken reply**: Egyptologists answer that every one of these texts was written long after the time it describes, that none carries a date, and that radiocarbon now dates Egypt's kings without them.

**Sources**: `hancock-bauval-1996`, `bauval-gilbert-1994`, `gantenbrink-1993`, `vondrak-2011`, `hyg-4.2`, `pharaoh-se-turin` (new), `gardiner-1959` (new, unchecked), `ryholt-2004` (new; content unchecked), `schwaller-1982` (new, unchecked), `waddell-1940` (new), `breasted-1906` (new), `pyramid-texts-online` (new), `piankoff-1968` (new, unchecked), `graham-2022` (new), `bronk-ramsey-2010` (new), `dee-2013` (new), `hornung-krauss-warburton-2006` (new)

---

## 5. The sky as a clock

**Narration** (219 words)

In 1989 Robert Bauval argued that the three pyramids of Giza are laid out like the three stars of Orion's belt. Two are nearly equal and stand on a diagonal. The third is smaller and set off the line, as Mintaka, the faintest, is.

To the Egyptians Orion was Sah, Osiris among the stars. A study published in 2026 tested the pyramids' triangle against almost seven hundred thousand triplets of bright stars. It ranks in the top quarter of one per cent. Every closer match is a group nobody ever named; Orion's belt is the first that someone did.

Bauval and Hancock take the plan as a clock. Over twenty-six thousand years the wobble of the Earth's axis raises and lowers the belt on the southern meridian. Drag the sky back. The belt sinks until, about 10,500 BCE, it reaches the bottom of its swing. That, they say, is the First Time, and the moment the plan records.

Inside the Great Pyramid, a shaft from the King's Chamber climbs south at 45 degrees. In about 2450 BCE, Alnitak, the belt's easternmost star, crossed the meridian within a fifth of a degree of that line. On their reading the stone holds two dates: when it was built, and when its plan was drawn.

They find numbers in it as well.

**Beats**

- "laid out like the three stars of Orion's belt" → a still of the plateau from directly overhead (`today`). C4's `sky-projection` overlay fades in as the reader scrolls, laying Alnitak, Alnilam and Mintaka over G1, G2 and G3 at a best-fit scale.
- "as Mintaka, the faintest, is" → Menkaure's offset from the G1–G2 line and Mintaka's offset from the Alnitak–Alnilam line are drawn as two ticks side by side, with their ratios: 0.185 and 0.148.
- "It ranks in the top quarter of one per cent." → a caption, not a chart: "Allan 2026: rank 1,717 of 695,520, p = 0.0025". The figure is cited, not computed.
- "Drag the sky back." → **live**, the piece's one interactive figure. A night render from the `orion` station has its sky cut out, and `@seked/sky` draws the southern meridian at Giza. The scroll moves the epoch from 2026 to −10449, and the reader can also drag it. The belt sinks. Readouts show Alnitak's transit altitude and the belt's angle to the meridian. A corner inset holds ghosts of the pyramids' G1–G3 diagonal (37°51′) and their G1–G2 line.
- "it reaches the bottom of its swing" → the slider settles at −10449 and the C4 receipt opens. The angle readout shows 50°51′ against 37°51′.
- "Inside the Great Pyramid" → **stills**, new: a section through the Great Pyramid from the east, with the shafts drawn with their surveyed bends from `g1-shafts.json`. The epoch is set to −2449.
- "within a fifth of a degree of that line" → C2's `shaft-rays` overlay extends the King's Chamber south shaft as a ray to Alnitak on the meridian, then the Queen's Chamber south shaft to Sirius. The scroll drives the epoch from −2700 to −2300, and the stars slide across their rays, crossing near −2492 and −2368 (`docs/shafts.md`).
- "the stone holds two dates" → two chips appear on the timeline: "built, c. 2450 BCE" and "plan, c. 10,500 BCE (claim)".
- "They find numbers in it as well." → the section fades to a clean profile. **Look around**: the `orion` and `kings-chamber` panoramas.

**Receipts**

- **C4, Orion Correlation**, at epoch −10449.
  - The belt's angle to the meridian is 50°51′40″ against the G1–G3 diagonal's 37°51′07″: a residual of +13°00′33″ (+34.4%) against a band of ±5%. **Does not hold.**
  - Menkaure's offset is 0.18527 against Mintaka's 0.148248: +24.97%. **Does not hold.** This comparison also depends on the proper motions: it moves by 4.66% between HYG and Stellarium.
  - Free choices (3): the epoch; how the sky map is turned onto the ground (the north–south inversion, which is recorded but not modelled); and the matching rule.
- **C2, Shafts point at stars**, at epoch −2449, with a band of ±1%.
  - King's Chamber south shaft against Alnitak: −12.2′. **Holds.**
  - King's Chamber north shaft against Thuban: +39.5′. **Does not hold.**
  - Queen's Chamber south shaft against Sirius: +14.9′. **Holds.**
  - Queen's Chamber north shaft against Kochab: −14.3′. **Holds**, but that shaft's angle is unverified and carries a sigma of 3.4°.
  - Free choices (2): the epoch, and which star goes with which shaft. Overall the claim is not within tolerance, because one shaft of four misses.
- **`docs/shafts.md`**, the epoch each shaft solves to on its own: Alnitak 2492 BCE; Thuban 3261 or 2333 BCE; Sirius 2368 BCE; Kochab 2380 BCE. The date moves 3 to 6 years for each arcminute of shaft angle. The file's header is out of date and needs regenerating.
- **C3, the descending passage and the pole star**, at epoch −2169: +4.9′ against Thuban's lower culmination. **Holds**, with one free choice: which of two crossings to use, near 3409 BCE or near 2185 BCE. The passage's 26°31′ is also within 3′ of atan(1/2), which needs no star.
- **C7, Collins's Cygnus**, using C4's method at −2499: −22°33′24″ and −42.45%. **Does not hold**, and fits worse than Orion.
- **C4b, "the belt at its nadir"** (proposed). A turning-point solver for `star.alnitak.transit.altitude`, with Bauval's 9°20′ as the target (`hancock-bauval-1996` p. 77). It reports the epoch of the minimum and how wide the window is within 0.5° and within 1° of it, which is the clock's resolution. It must state that refraction (about 5 to 6′ at 9° altitude) is not modelled.
- **An epoch solver for C4** (proposed, like `pnpm shafts`): the epoch at which the belt's angle equals 37°51′, and the epoch for the G1–G2 line (Bauval's reply to Fairall).

**The reply**

The shape is real. The same 2026 study calls the match "real but narrow". Almost everything built on it fails. At no epoch does the pyramids' axis match the belt's better than chance, and its best fit, about 11,625 BCE, has no archaeology behind it. The best way to assign the stars to the pyramids is the reverse of Bauval's, and no assignment keeps both the shape and the order of brightness. At 10,450 BCE, Seked's own engine puts the belt thirteen degrees off the pyramids' diagonal. Nor is 10,450 BCE the bottom of the swing: the engine puts Alnitak's lowest crossing near 10,700 BCE, and the star stays within half a degree of that low for some fourteen centuries, from about 11,450 to 10,000 BCE. As a clock, the belt cannot name a century. The shafts were never sightlines: the King's Chamber shafts bend on their way out, and the Queen's Chamber shafts stop at small stone doors about sixty metres in. The epochs the shafts give cluster between about 2500 and 2330 BCE, close to Khufu's reign. The sky dates the building, where Egyptologists already had it, not an older plan.

**Spoken reply**: Astronomers answer that the shapes do match, but in 10,450 BCE the belt lies thirteen degrees off the pyramids' line, and the shafts point to Khufu's century, not the Ice Age.

**Sources**: `bauval-gilbert-1994`, `hancock-1995`, `hancock-bauval-1996`, `gantenbrink-1993`, `gantenbrink-1999`, `vondrak-2011`, `hyg-4.2`, `krupp-1997`, `fairall-1999`, `collins-2006`, `petrie-1883`, `spence-2000`, `bauval-1989` (new; citation checked, text unchecked), `allan-2026` (new), `trimble-1964` (new; citation checked, text unchecked), `badawy-1964` (new; citation checked, text unchecked), `legon-1995` (new)

---

## 6. Numbers in the stone

**Narration** (219 words)

Measure the Great Pyramid. Walk once round its base and divide the distance by its original height. The answer is two times pi, to within three hundredths of one per cent.

Draw a line from the apex down the middle of one face. Divide it by half the base and you get the golden ratio, within a twentieth of one per cent.

Scale the pyramid up 43,200 times. Its height becomes the distance from the Earth's centre to the pole, and its perimeter the equator, each within one per cent. Graham Hancock points out that 43,200 is 600 times 72, and that 72 years is about how long the stars take to drift one degree.

The sides run within four minutes of arc of true north. On a side of 230 metres that is a quarter of a metre, with no compass.

Writers since Charles Piazzi Smyth in the 1860s have read these numbers as a design brief: the circle, the golden section, the size of the Earth and the slow turn of the sky, written into one shape. For Hancock, the knowledge was inherited from a civilisation older than Egypt. Each number alone has an ordinary explanation. The proponents ask whether the explanations hold when the numbers come together.

Knowledge that old needs people to have held it.

**Beats**

- "Measure the Great Pyramid." → **stills**, new: a clean orthographic profile of the Great Pyramid as built, seen from the south with its casing restored, labelled "reconstruction".
- "Walk once round its base" → **live SVG**: a point travels round the base square as the reader scrolls, drawing the perimeter.
- "The answer is two times pi" → A1's `ghost-profile`: the perimeter unrolls into a circle whose radius is the height. Readout: 6.28501 against 6.28319, +0.03%.
- "Draw a line from the apex down the middle of one face." → the apothem is drawn and the Kepler triangle appears in the cross-section. A2's `face_square` fills a square on the height beside one face triangle until the two areas match.
- "Scale the pyramid up 43,200 times." → B1's `ghost-earth`: the scroll drives the scale factor, and the profile grows into the northern hemisphere. Readouts: −0.38% and −0.68%.
- "The sides run within four minutes of arc of true north." → C1's `compass-rose` on the pavement, radius 190 m, with the measured side 3′54″ west of north. The angle is drawn 120 times larger than life, and the screen says so.
- "written into one shape" → the four overlays shrink into a row of small multiples, each with its residual and its count of free choices.
- "Knowledge that old needs people to have held it." → the profile fades, and chapter 4's timeline returns and runs left towards the Ice Age.

**Receipts**

- **A1, π in the profile:** `g1.base.perimeter / g1.height.original` is 6.28501 against 2π, +0.03%. **Holds**, with no free choices. Under the other presets: Petrie −0.05%, Cole −0.04%, Dash +0.04%.
- **A2, φ in the face:** apothem over half-base is 1.6187 against φ, +0.04%; face area over height squared is −0.09%. **Holds**, with no free choices.
- **A3, seked 5½ explains both:** the measured face angle is 51°50′40″.
  - Against the seked of 5½ (51°50′34″): +5.9″.
  - Against the π slope (51°51′14″): −34.5″.
  - Against the φ slope (51°49′38″): +1.0′.
  - All three hold, so the survey cannot tell them apart. Under Petrie's verified angle the order changes: π +45.8″, seked +1.4′. The page should say "cannot discriminate", not that the seked wins.
- **B1, 1 : 43,200:** height × 43,200 is 6,332.7 km against the polar radius, −0.38%; perimeter × 43,200 is 39,801 km against the equatorial circumference, −0.68%. **Holds** inside ±1%, with 2 free choices: the factor, and which radius and which circumference. It adds nothing beyond A1 except the choice of factor. The best-fitting factors from the same records are about 43,364 and 43,497. **B5** is the same claim restated, at −0.68%.
- **C1, True north:** −3′54″ (Dash), inside ±5′, with no free choices. Petrie gives −3.7′ and Cole −3.1′. On the ground that is about 0.26 m over a 230.36 m side.
- **A7, Khafre's 3-4-5:** +2.2′. **Holds.** Khafre used a different seked, 5¼.
- **A drawer, "more numbers"**, with each verdict:
  - A4, King's Chamber 3-4-5: holds (1 free choice).
  - A5, cubit = π/6 = φ²/5: holds (1 free choice). π/6 and φ²/5 agree with each other to 0.002% with no help from Egypt.
  - B2, height × 10⁹: holds inside ±2.5% (2 free choices).
  - B3, latitude = speed of light: holds (3 free choices; the reductio).
  - B4, the pyramid inch: misses on the casing line (−0.79%), holds on the socket line (3 free choices).
  - D1, Heliopolis: misses (−1°38′52″).
  - D2, Legon's rectangle: holds (1 free choice).
  - D3: the meridian holds, the quadrant misses.
- **Proposed, with no new data needed:**
  - Latitude 30°: `g1.center.latitude` against 30 gives −1′15″, about 2.3 km. It rests on the `coords-wgs84-cited` placeholder.
  - A1 against 44/7: −0.011%.
  - A1 against the scribes' 2 × 256/81: −0.57%, once that value has a checked source.
- **Proposed data:** the Fourth Dynasty orientation sequence from `spence-2000` Table 1, and the star-pair epochs, with the stars cut from HYG.

**The reply**

Egyptian builders gave a slope as a seked: so many palms of run for a rise of one cubit, which is seven palms. A seked of five and a half makes a pyramid 440 cubits wide and 280 high. Its perimeter divided by its height is then 44/7, which is 2π to within 0.04 per cent, and the same triangle comes within 0.04 per cent of φ. Both numbers fall out of one whole-number rule, and the papyri set seked problems as exercises. Seked's A3 shows the survey cannot tell the three slopes apart. The original height is not measured either: the apex is gone, so π, φ and 43,200 are one face angle seen three ways. And 43,200 is chosen: the best-fitting factors are about 43,364 and 43,497. On north, Spence's survey of the Fourth Dynasty pyramids shows alignment improving up to Khufu and then slipping.

**Spoken reply**: Mathematicians answer that one builders' rule, a slope of five and a half palms in seven, gives both pi and the golden ratio, and that 43,200 is a number chosen to fit.

**Sources**: `petrie-1883`, `cole-1925`, `dash-2015`, `lehner-1997`, `smyth-1864`, `tompkins-1971`, `hancock-1995`, `rossi-2004`, `spence-2000`, `legon-1979`, `wgs84`, `coords-wgs84-cited`, `si-2019`, `rossi-imhausen-2009` (new), `dash-2017` (new), `herz-fischler-2000` (new)

---

## 7. Before the flood

**Narration** (210 words)

About 12,900 years ago, as the last Ice Age was ending, the warming stopped. For more than a thousand years the northern world fell back into cold. Geologists call it the Younger Dryas. Hancock cites about a hundred peer-reviewed studies arguing that fragments of a comet set it off. At Abu Hureyra, an early village in Syria, their authors report glass melted at more than 2,200 degrees.

Then, as the cold lifts, a monument appears on a hilltop in south-east Turkey. Göbekli Tepe is a set of great rings of T-shaped stone pillars, carved with animals. It was built around 9500 BCE, seven thousand years before the Great Pyramid. Its excavators say the people who built it were still hunters and foragers. They had no farms, no pottery and no metal. Its first excavator, Klaus Schmidt, believed they later filled it in on purpose.

Schoch now points to Göbekli Tepe when he is asked where the older civilisation was. For this piece too, it is what makes the rest worth taking seriously. If people who did not farm could raise this, then a plan laid out at Giza in the eleventh millennium BCE is not absurd. It is a question of evidence.

Some of that evidence has never been gathered.

**Beats**

- "About 12,900 years ago" → a full-bleed timeline strip: an ice-core temperature curve (NGRIP δ¹⁸O on GICC05, to be imported with a source record, never drawn by hand) from 15,000 to 8,000 BP. The scroll moves a cursor along it.
- "Geologists call it the Younger Dryas." → the dip is shaded, with markers at its onset (c. 10,900 BCE) and its end (c. 9,700 BCE). C4's 10,450 BCE and C5's 10,500 BCE drop onto the strip, inside the dip.
- "At Abu Hureyra" → a map inset with Abu Hureyra, Göbekli Tepe and Giza.
- "a monument appears on a hilltop in south-east Turkey" → **sequence**, new: Enclosure D as a labelled stand-in, built from published plans (read two ways) and CC photographs. The scroll circles the camera round the ring at eye height, with a human figure for scale.
- "no farms, no pottery and no metal" → the phrase appears as a caption on the stage.
- "believed they later filled it in on purpose" → the scroll raises the fill into the enclosure, labelled "Schmidt's reading, since revised".
- "a plan laid out at Giza in the eleventh millennium BCE" → a crossfade to Giza's First Time: the green Sahara (`render/giza/vegetation.py`), the Sphinx and its temples, no pyramids, and the plan drawn by the page. Corner label: "a claim state".
- "Some of that evidence has never been gathered." → the camera descends towards the floor of the Sphinx ditch.

**Receipts**

- **The timeline as records** (proposed; dates need a unit decision first):

  | Event | Date |
  |---|---|
  | Younger Dryas onset | 12,896 b2k, about 10,900 BCE (`walker-2009`; the page draws GICC05's 10,897 BCE) |
  | Younger Dryas end | 11,700 b2k, about 9,700 BCE (`walker-2009`) |
  | Göbekli Tepe begins | c. 9,500 cal BC (`clare-2020`) |
  | C4's epoch | −10449 (10,450 BCE) |
  | C5's epoch | −10499 (10,500 BCE) |

  It shows that both of Giza's chosen epochs fall inside the Younger Dryas, and that Göbekli Tepe begins about two centuries after the Younger Dryas ends, roughly a thousand years after those epochs.
- **C8, Pillar 43** (proposed).
  - **Free choices:** Sweatman's identifications of each animal with a constellation.
  - **Computed:** the epoch at which the solstice sun reaches the chosen stars, from Vondrák precession. The stars are to be cut from HYG by `pnpm run stars`.
  - His ±250 years is about ±3.5° on the sky.
  - It makes plain that the date follows mechanically from the identifications. The inputs are not yet confirmed (see the open questions).
- **Tier:** `gobekli-tepe` would be `excavated` in `data/structures.json`, with a site in `data/sites.json`. Its tier says nothing about Giza.

**The reply**

No one doubts Göbekli Tepe's age, or that hunter-gatherers built it. What the excavators have changed since 2019 is the picture of the place. Lee Clare's 2020 summary for the German Archaeological Institute reports round houses with hearths on the bedrock, a burial under a floor, and a rock-cut pit eight metres across, possibly a cistern, with a channel cut nearby. The special buildings stood in use for more than five centuries. The fill, once read as a deliberate burial, now looks like slope slides of debris from the higher ground around them. On the comet, thirteen specialists published a "comprehensive refutation" in 2023: no crater has been found, and the markers are too small and too poorly dated. Several of the group's other papers were retracted in 2025 and 2026. Nothing found at Göbekli links it to Egypt, about 1,100 kilometres away.

**Spoken reply**: The excavators answer that Göbekli Tepe was a lived-in place with houses and a possible cistern, filled by slope slides rather than by hand, and that nothing found there links it to Egypt.

**Sources**: `hancock-1995`, `hancock-bauval-1996`, `clare-2020` (new), `hancock-2023-saa` (new), `schoch-sphinx-web` (new), `moore-2020` (new), `moore-2025-correction` (new), `holliday-2023` (new), `retraction-watch-2026-ydih` (new), `notroff-2017` (new), `firestone-2007` (new, unchecked), `walker-2009` (new, unchecked), `schmidt-2007` (new, unchecked), `sweatman-tsikritsis-2017` (new, unchecked), `hancock-2015` (new, unchecked)

---

## 8. Underneath

*A draft, written by the night builder on 20 October from `docs/research/khafre-sar.md` and `docs/research/labyrinth.md` (night list, decisions 23 to 27). It has not yet been edited by the session or read by Stewart.*

**Narration** (215 words)

Everything so far stands on the surface. The proponents say the oldest part of Giza may lie beneath it.

In March 2025 an Italian team that includes a radar engineer, Filippo Biondi, showed what they said satellites had found under Khafre's pyramid. Radar cannot see far into rock, and Biondi agrees. Their method reads instead the faint vibrations of the ground, the way an ultrasound reads a body. What they read is eight hollow wells in two rows, wound with spiral paths, falling 648 metres to two great chambers about 80 metres on a side. That is four and a half times the pyramid's height, straight down.

The rooms anyone has walked into lie three metres under its base.

Eighty kilometres south, at Hawara, stood the Labyrinth. Herodotus saw it and said it surpassed the pyramids: three thousand rooms, half of them underground, which nobody would show him. Petrie found only a bed of stone chips, larger than the Great Pyramid's base. In 2008 Egypt's own geophysics institute surveyed the ground there, and the expedition behind it reported walls eight to twelve metres down.

Under the Sphinx's paws, Schoch's seismic survey found a hollow that has never been opened. Edgar Cayce said a Hall of Records waited there.

Nobody has dug for any of it.

**Beats**

- "Everything so far stands on the surface." → **live over stills**, new: the cutaway. Khafre's pyramid and the plateau east of a north–south plane through its axis are cut away, and the rock is drawn as in an x-ray, in the `today` era from the south-east.
- "under Khafre's pyramid" → the team's tomogram appears as a plate on the section plane, placed by its own labels (the base and 648 m), captioned "Khafre Project, 2025; placed by its labels, not scaled". Until permission is given, the plate is a link and a grey frame.
- "the way an ultrasound reads a body" → a small diagram inset: the radar's return off the surface, and a ring of vibration spreading in the rock, labelled "the method as its authors describe it".
- "eight hollow wells in two rows" → the claimed geometry draws itself downwards in the claimed tier's look (dashed, translucent, never stone): the five Zeds in the base, then the eight wells and their spirals. A small label: "diameter, spacing and spiral pitch not published; drawn as a look choice".
- "two great chambers about 80 metres on a side" → the two cubes at −648 m.
- "four and a half times the pyramid's height" → ghosts of Khafre's pyramid stack beside the wells, one, two, three, four and a half, with the receipt counting.
- "three metres under its base" → the camera rises to the base. The excavated substructure (`g2-interior.json`) is drawn in stone, a hairline at this scale. A depth scale runs down the left edge: −3 m, the burial chamber's floor; about −30 m, the Osiris Shaft under the causeway; −648 m.
- "Eighty kilometres south, at Hawara" → a still at Hawara: Amenemhat III's pyramid from Petrie's figures, the canal, and the chip bed to its south.
- "larger than the Great Pyramid's base" → the chip bed and Hawara's pyramid laid on Giza beside the Great Pyramid at the same scale, labelled "at Hawara, 80 km south; laid here for scale".
- "walls eight to twelve metres down" → a north–south section south of Hawara's pyramid: Petrie's chips, Elshazly's closures at 5 and 7.5 m as solid boxes, the Mataha walls dashed and labelled "reported, unpublished", the water table as a blue band from 1.5 to 10 m, limestone at 12 to 15 m, and Herodotus's lower storey as a ghost.
- "Under the Sphinx's paws" → back at Giza: the paw cavity (`claimed`) as a dashed outline about 5 m down, and the Hall of Records (`legendary`) ghosted under it.
- "Nobody has dug for any of it." → every underground object on one depth scale, coloured by tier. Hold, then on into chapter 9.

**Receipts**

- **Depths against heights.** 648 m against `g2.height.original` is four and a half pyramid heights. Against the burial chamber's floor (`g2.passage.horizontal.floor.begin.up`, −3.0 m, `maragioglio-rinaldi-1966`, verified), the claimed wells go about 216 times deeper than any known room of Khafre's. Both are new labels, computed, with no target and so no residual.
- **The known against the claimed**, by tier from `data/structures.json`:
  - `excavated`: Khafre's substructure, `osiris-shaft`, and at Hawara the pyramid and the chip bed (proposed).
  - `instrumented`: the Hawara closures of Elshazly 2024 (proposed).
  - `claimed`: `g2.sar-shafts`, `sphinx.paw-cavity`, and at Hawara the Mataha walls and the Merlin Burrows levels (proposed).
  - `legendary`: `hall-of-records`, and Herodotus's lower storey (proposed).
- **The Labyrinth's size.** Petrie's chip bed against Khufu's base (`g1.base.side.mean`) is about 1.4 times the area, computed by `@seked/geometry` once Petrie's figures are records.
- **What the claim gives and does not.** The abstract gives a count, two rows, a depth and a cube size. It gives no diameter, no spacing and no scale bar, and the receipt lists those as the free choices our drawing needed.
- **Proposed data:** every claimed figure in `data/measurements/g2-sar.json` with `method: "as claimed"`; Petrie's Hawara in `data/measurements/hawara.json`; Hawara in `data/sites.json`; the water table (`sharafeldin-2019`) and Khufu's base elevation above sea level, so the section can draw how far the wells stand below the groundwater.

**The reply**

The method's only peer-reviewed paper, Biondi and Malanga's 2022 study of Khufu's pyramid, was retracted on 10 August 2026 for "serious methodological flaws and statistical errors"; the authors disagree. Radar specialists say that a satellite measures only the surface it sees, and that vibrations from hundreds of metres down are far too small to detect from orbit. No data or code has been released, so nobody has been able to check the processing. Egypt's antiquities authority gave no permission for work at Khafre, and Zahi Hawass says the pyramid sits on bedrock carved about eight metres down. Wells that deep would stand hundreds of metres below the water table. At Hawara, Petrie found Amenemhat III's name on the Labyrinth's architraves: it was his temple, built in the nineteenth century BCE, seven centuries after Khufu. The 2008 survey's own leader has since published, with colleagues, anomalies only five to seven and a half metres down, and an independent radar survey found "nothing to support the idea that this was Herodotus's labyrinth". Herodotus says himself that he only heard of the lower rooms.

**Spoken reply**: Archaeologists answer that the radar method's only peer-reviewed paper was retracted and its data never released, and that the Labyrinth was Amenemhat III's temple, where the published surveys find only shallow remains.

**Sources**: `khafre-project-2025`, `maragioglio-rinaldi-1966`, `petrie-1883`, `hawass-2007`, `dobecki-schoch-1992`, `cayce`, `biondi-malanga-2022` (new), `remote-sensing-retraction-2026` (new), `retraction-watch-2026-giza` (new), `pilicy-2025` (new), `el-aref-2025` (new), `moss-2025-natgeo` (new), `alvarez-1970` (new), `sharafeldin-2019` (new), `herodotus-2-148` (new; checked only as quoted by Carlotto), `petrie-1889` (new), `petrie-1890` (new), `petrie-1912` (new), `elshazly-2024` (new), `szynkiewicz-2015` (new), `khalil-2010` (new; abstract only), `de-cordier-2025-mataha` (new), `de-cordier-2025-merlin-burrows` (new)

---

## 9. What would settle it

**Narration** (219 words)

Much of this case can be tested. Under the Sphinx, the test that matters most has not been made.

Look beneath the floor of the ditch. Schoch's seismic lines found the rock weathered more deeply in front of the lion than behind it. That difference is the only measured support for the early date, and no one has tested it by drilling. Two cores, one at the paws and one behind the rump, would show whether it is weathering, as Schoch says, or a change in the rock itself.

It can be done. In 2008 Egypt's antiquities authority and Cairo University drilled four boreholes twenty metres into the bedrock around the Sphinx, to watch the groundwater. We have found no published record of how weathered that rock was.

Underneath, the paw cavity could be opened, the radar team could release its data, and a dig at Hawara could go below the chips.

An answer looks like this: inside the Great Pyramid, muon detectors found a hidden corridor, gave its size with error bars, and a camera confirmed it.

Hancock, Bauval and Schoch read the stone, the sky and the texts as one story. Where it has been measured, the measurements have mostly gone against it. The ditch floor has not. Until it is, that is where to look.

**Beats**

- "Much of this case can be tested." → **live over stills**: the `sphinx` shot in the `today` era. The ground turns translucent, putting the enclosure in x-ray.
- "Look beneath the floor of the ditch." → a long east–west section under the Sphinx. The weathered zone is a translucent band, about 2 m deep at the front thinning to about 1.2 m at the rump (W1's proposed inputs, labelled "by Schoch's account, unverified"). A blue line marks the water table at about 15 m elevation against a floor at about 20 m (`sharafeldin-2019`).
- "Two cores, one at the paws and one behind the rump" → the scroll drops two dashed cores through the band to sound rock, labelled "not yet drilled".
- "In 2008" → a plan view with four solid pins for boreholes PZ/S1 to S4, scaled from the YSI plan and registered on the Sphinx's outline, with their sigma. They are labelled "drilled 2008, logs not published", and in the section each runs down 20 m.
- "Underneath" → chapter 8's depth scale returns, each claim with its test drawn dashed beside it:
  - the paw cavity (`claimed`): a dashed outline with no error box, and a dashed core into it;
  - the Hall of Records (`legendary`): ghosted;
  - the SAR shafts under Khafre (`claimed`): dashed, small, off to the west, labelled "data not released";
  - the Hawara section: a dashed trench below Petrie's chips, labelled "not yet dug";
  - the rump passage (`excavated`): solid.
- "An answer looks like this" → a cut to chapter 5's section of the Great Pyramid. The north-face corridor (`instrumented`) is a solid box with its error bars. The Big Void (`instrumented`) is a hatched zone 40 to 50 m above the Queen's Chamber floor.
- "read the stone, the sky and the texts as one story" → a strip of the nine chapters' key frames runs briefly across the stage.
- "Until it is, that is where to look." → back to the Sphinx at dawn, chapter 0's last frame, with the two dashed cores still drawn in the floor. Hold. End.

**Receipts**

- **Evidence tiers** from `data/structures.json`:
  - `excavated`: `sphinx`, `sphinx.passages`.
  - `instrumented`: `g1.big-void`, `g1.north-face-corridor`.
  - `claimed`: `sphinx.paw-cavity`, `g2.sar-shafts`.
  - `legendary`: `hall-of-records`.
- **The model answer**, from `data/measurements/g1-voids.json` (all verified, `procureur-2023` and `morishima-2017`):
  - The corridor runs 9.06 ± 0.07 m north to south (`void.north_face_corridor.width`, which the paper calls its length) and 2.02 ± 0.06 m east to west (`.length`). It is 2.18 ± 0.17 m high, about 20 m above the ground, and 0.84 ± 0.05 m behind the Chevron.
  - The Big Void is at least 30 m long, its centre 40 to 50 m above the Queen's Chamber floor, with two hypotheses for its inclination.
  - The Sphinx's claimed cavity has no comparable figures at all.
- **Proposed data:**
  - Weathered-zone thickness under the floor (with W1).
  - The 2008 boreholes as points scaled from the plate, with sigma, never verified. Their printed elevations are 20.492, 20.480, 20.505 and 20.193; the datum is not stated.
  - The water table (`sharafeldin-2019`).
  - Physical dates as records. The brief's arithmetic on the checked table, not yet the engine's:

    | Sample | Age | Against Khafre, c. 2520 BCE | Against 7000 BCE |
    |---|---|---|---|
    | ST2, limestone | 2220 ± 220 BCE | 1.4σ younger | about 22σ |
    | VT1, granite | 3060 ± 470 BCE | 1.1σ older | 8.4σ |
    | ST5, granite | 3100 ± 540 BCE | 1.1σ older | 7.2σ |
    | Menkaure, granite | 3450 ± 950 BCE | 1.0σ older | 3.7σ |

    Against 10,500 BCE, every sample is more than 7σ away.

**The reply**

Most of what could be dated has been. In 1984 the Edgar Cayce Foundation, interested in Cayce's claim that the pyramids dated to 10,500 BCE, paid for radiocarbon dates on organic material in their mortar. More than 450 samples from 1984 and 1995 place the Fourth Dynasty monuments between about 2900 and 2400 BCE. That is a few centuries older than the historical dates, which the team traces to old wood burned for the mortar. The luminescence team that the proponents cite found nothing that "corroborates a prehistoric age". In 1978, five holes drilled into the largest anomalies around the Sphinx found "only minor natural cracks". Egypt permits instrumented, peer-reviewed work: that is how the corridor was found.

**Spoken reply**: Archaeologists answer that none of the physical dates taken at Giza, the first of them paid for by Cayce's own foundation, comes anywhere near 10,500 BCE, and that the holes drilled into the Sphinx's anomalies in 1978 found only cracks.

**Sources**: `dobecki-schoch-1992`, `morishima-2017`, `procureur-2023`, `cayce`, `arce-sphinx-1991`, `bonani-2001` (new), `aera-radiocarbon` (new), `liritzis-vafiadou-2015` (new), `dolphin-1978` (new), `ysi-2009-sphinx` (new), `sharafeldin-2019` (new), `harrell-1994` (new), `schoch-1992-kmt` (new, unchecked)

---

## Running time

At 150 words a minute:

| Chapter | Words | Time |
|---|---:|---:|
| 0. Cold open | 113 | 0:45 |
| 1. Older than it should be | 219 | 1:28 |
| 2. A lion, not a king | 219 | 1:28 |
| 3. Temples of the same stone | 218 | 1:27 |
| 4. The First Time | 219 | 1:28 |
| 5. The sky as a clock | 219 | 1:28 |
| 6. Numbers in the stone | 219 | 1:28 |
| 7. Before the flood | 210 | 1:24 |
| 8. Underneath (draft) | 215 | 1:26 |
| 9. What would settle it | 219 | 1:28 |
| **Total** | **2,070** | **13:48** |

The ten spoken replies come to about 320 words, roughly two minutes, so autoplay runs about 16 minutes, a minute over the plan's 12 to 15. Chapter 8 is where to trim if Stewart wants it back inside.

## Open questions for Stewart

**Unchecked sources the script leans on**

1. **The seismic depths (chapters 1, 8 and 9).** Dobecki and Schoch's own figures have not been read: the depths, their sigmas, S4's "about 4 m", and the paw anomaly's size and its "about 5 m" depth in `structures.json`. The "two metres" and "a little over one" come from Reader and Harrell quoting Schoch's *KMT* article, so the narration says "by his account". W1 cannot go into `data/` until the paper is read, and it should be read before the voice records chapter 1.
2. **A reported reversal.** One search snippet says a later Dobecki study found "no evidence" of wet-period weathering. If that is confirmed, chapters 1 and 9 change. It needs checking before anything is recorded.
3. **When Schoch first looked.** The 1991 GSA abstract is unchecked, so the narration says "the early 1990s" rather than a year.
4. **Reader 2026** is known only through two reviews. Chapter 2's narration names it, through Lacovara, who read the book. Reader 2001's page range conflicts between sources (149–165 or 149–159).
5. **Chapter 3.** The 1993 NBC film was not seen; West and Schoch are known only as Lehner quotes them in 1994. The findspot of Khafre's statues is checked only through summaries. The air date of Hancock's Fridman interview is unchecked.
6. **Chapter 4.**
   - The Turin numerals are partly restored, and whether 23,200 includes 13,420 is open. The narration says "in the next line" to avoid committing.
   - The Pyramid Texts quotations come from a modernised Piankoff. Allen's or Faulkner's wording may be the better choice for the plates, and the plates need licensed photographs.
7. **Chapter 5.** The page computes the belt's minimum (`lowestTransit` in `apps/story/src/sky.ts`): Alnitak crosses lowest in 10,719 BCE at 9°08.6′, against 9°12.8′ at 10,450 BCE, and within half a degree of it from 11,443 to 9,995 BCE (refraction not modelled). "About 10,500 BCE, the bottom of its swing" holds to three centuries, and the reply now says how coarse the clock is (Stewart, 20 October). C4b as a claim file is still to write. Allan 2026 carries an AI-use disclosure and fits only three points; a reader may ask about either.
8. **Chapter 6.**
   - Hancock's page for "600 times 72" was not found; the attribution rests on B1's proponent list.
   - The scribes' 256/81 is kept out until it has a checked source.
   - C1 quotes Spence's date as about 2467 BCE, while her Table 1 gives 2480 ± 5 BC.
   - The dossier dates from 2 October.
9. **Chapter 7.**
   - The Younger Dryas dates rest on Walker 2009, which is unchecked and has a DOI from memory.
   - Pillar heights, the carved arms and belts, Pillar 43, and Karahan Tepe and the wider Taş Tepeler sites are all left out of the narration for want of checked sources. Each would strengthen the claim if it were checked.
   - "About 1,100 kilometres" is arithmetic on approximate coordinates.
10. **Chapter 2's reply.** "The Egyptian zodiacs that show it … are late" rests on Aubourg's listing. The proponents' best answer to it, a native Egyptian "Lion" constellation in Neugebauer and Parker, is unchecked and not in the script.
11. **Chapter 9** (chapter 8 before the split).
    - The script says nothing about anyone asking to drill and being refused, because no primary source was found.
    - The 2008 borehole logs would be worth asking the SCA or Cairo University for.
    - The note on `g2.sar-shafts` says "the Egyptian antiquities authority rejected it". The brief found only Hawass, a former minister, calling it baseless, so the note needs correcting.
11a. **Chapter 8, the new draft** (night of 20 October).
    - It is a draft in the script's voice, not yet edited. It names Biondi only, as the radar engineer whose method it is; the abstract is signed by Biondi, Mei and Malanga.
    - "Hawass says the pyramid sits on bedrock carved about eight metres down" is his word in Al-Ahram Weekly (8 April 2025), as the brief read it; the narration does not repeat his "fake news".
    - The Mataha walls (8 to 12 m) are told as "the expedition behind it reported", because no report has been published. The Merlin Burrows levels are in the beats and receipts only, not the narration, for want of words; they could replace the Hall of Records line.
    - The pyramids' heights: "four and a half times" is 648 m over `g2.height.original`; the label is computed, not typed.

**Choices of emphasis (yours)**

12. **Left out entirely:** the Domingo face comparison (every detail is unchecked), the Osireion, the Edfu building texts, Temple's Anubis and Sweatman's Pillar 43. Each could come back as a line once it is checked.
13. **Chapter 7 says, in the narrator's voice:** "For this piece too, it is what makes the rest worth taking seriously." The brief records this as your view and the piece's (19 and 20 October), so it stays; it is listed only because it is said in the main voice.
14. **Chapter 9's close says plainly:** "Where it has been measured, the measurements have mostly gone against it." That is a verdict in the main voice, not the reply's. It is the honest close the brief asked for, but its strength is your call.
15. **Chapter 2 says the Lion "rose in the east"**, not "due east". The beat draws the 10° gap and the receipt states the miss.
16. **Chapter 5 gives only the King's Chamber shaft.** Sirius is left out for word count, and the Thuban miss appears only in the receipt.
17. **Reader appears on both sides:** as support for running water in chapter 1's narration, and against the date in the reply panels. Check that this is the balance you want.

**Data and schema**

18. **Dates as records:** king-list totals, radiocarbon, luminescence and the Younger Dryas. They need a new quantity (an epoch in astronomical years, as the claims' `epoch:` already uses) and a sentence in `CLAUDE.md`.
19. **Pending corrections:**
    - `fairall-1999` should be *Astronomy & Geophysics* 40(3), 3.4.
    - `krupp-1997` should be vol. 93(2), p. 64.
    - The header of `docs/shafts.md` is out of date.
    - The dossier should be regenerated.
20. **The head-fit number (H1)** is 0.39 (3.17 m of king's head inside 8.08 m of lion's head), from the master and the king's head, both stand-ins. To make it a claim file, it needs the real head's height (scaled off an ARCE elevation) as the target, with the two meshes named as its free choices.

## Edits to the first draft

Made by the cloud session on 20 October, against the briefs:

- Chapter 3: Petrie's hundred tons is now in his own terms ("ranging in their weight to over a hundred
  tons each", ch. XIV §95, checked against the transcription in the brief).
- Chapter 4: the pyramids' sites are no longer "bare rock". In the First Time they are flattened but
  grow like the ground round them (daylog decision 5), and the page draws the plan.
- H1 and open question 20: the master lion is now made in the cloud, not waited for from the laptop.
- Open question 13: Göbekli Tepe's place in the piece is the brief's agreed view, so it is no longer
  put as a question.

Made by the night builder on 20 October (`docs/night-2026-10-20.md`, item 2):

- Chapter 8 split in two (decision 23): a new chapter 8, *Underneath*, drafted from the two new briefs,
  and the old chapter 8 renumbered 9. Chapter 9's "Under the paws" line now names a test for each claim
  underneath (open the cavity, release the radar data, dig at Hawara), and its reply leaves the radar
  claims to chapter 8's.

