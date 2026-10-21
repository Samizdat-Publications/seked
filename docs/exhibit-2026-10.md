# The exhibit, October 2026

Agreed with Stewart on 20 October 2026, after he looked at the scroll page (`apps/story`) and found it read as an
article with photographs beside it: the renders looked worse than the September ones, and the 3D was gone. This
replaces the format in `docs/rethink-2026-10.md` ("a scroll documentary"). The goal, the argument, the ten
chapters, the script and the rule that every number comes from `data/` all stand.

## What it is

**A narrated exhibit, in the manner of the Antikythera project.** The picture is the whole screen. A narrator
walks the visitor through the case in **leaves**: each leaf puts the visitor somewhere on the plateau, in an era,
at a time of day, looking a certain way, with certain lines drawn, while one or two sentences are spoken and shown
as a caption. Between leaves the camera flies. At any leaf the visitor can stop and take over: look around, drag
the era, drag the sky, turn an object in their hands. Play carries on from where they left off.

The receipt (measured against claimed) and the archaeologists' reply sit one tap away on every leaf, as the
Antikythera exhibit keeps its numbers: wonder first, rigour on demand.

## The pictures: path-traced, rendered on the laptop

Everything the visitor sees of the plateau is a Cycles render made on the laptop with the full asset chain (block
masonry, CC0 photographed stone, Sketchfab props, Meshy figures, HDRI skies). The realtime viewer is not the
stage; it could not match these up close, which is why the September plan turned to path tracing.

The scroll page looked worse because its stills were the mid-September progress renders (0011, 0018, 0026), from
before the block-scale masonry. The exhibit is rendered fresh, at the leaf's own view, from today's pipeline.

## The five kinds of moment, and how each changes to the next

No dissolves. Stewart: "the slow dissolve thing didn't work". Each change is something that happens in the world.

| Moment | What the visitor gets | How it changes |
|---|---|---|
| **Station** | A 360° path-traced panorama (4096 by 2048), drag to look, zoom into detail patches. | |
| **Flight** | A rendered camera move between two leaves' views (about 3 s, 30 fps, 1920 by 1080), played as video. | Its last frame is the next leaf's view, rendered in the same era and moment, so the panorama takes over with no visible join. |
| **Era change in place** | The same station in another era. | A **wipe**: a hard edge sweeps across the view (sunlight's direction, or the ditch's floor rising), the new era behind it. In narrated play the wipe runs on its own; paused, the visitor drags the edge and compares. |
| **Weathering** | A rendered sequence of the same view through the eras (the lion worn by rain, the head re-carved), 30 to 60 frames. | Scrubbed by a slider; played as a time-lapse in narrated play. |
| **Lines and figures** | The claim drawn in the scene: registered 3D lines (the existing `overlays.json` machinery), the sky from `@seked/sky`, π and φ on the pyramid. | Each line draws itself on, in time with the word that names it. |

Rule that keeps the joins clean: **two leaves joined by a flight share an era and a moment.** A change of era or of
time of day happens in place, as a wipe or a sequence, never in mid-air.

## Objects in the hand

Where the subject is one object, the visitor holds it, as the Antikythera exhibit holds its gears: a small
realtime three.js view, turned by dragging. These read well in realtime because they are small and lit simply.

- The Sphinx's head: the master's lion head translucent round `sphinx-built`'s king's head, H1's scale factor as
  the receipt (chapter 2's hero).
- The Great Pyramid for the numbers (chapter 6): the perimeter unrolling into a circle of radius the height; the φ
  triangle cut through it; the globe at 1 : 43,200; the compass at true north.
- The underground (chapter 8): the plateau cut through Khafre's axis, the claimed wells orange and translucent, the
  known rooms and the water table, turnable.
- Enclosure D (chapter 7), stand-in, with its fill rising.

## The Sphinx

The real eras take the Meshy models (`sphinx-built` for 2500 BCE, `sphinx-meshy` from photographs for 1800 CE and
today). The master lion, with item 36's enlarged head, serves the two claim eras only. Decided by the laptop session
with Stewart's agreement (`docs/laptop-2026-10-20.md`, decision 8).

## Narration

ElevenLabs, as the Antikythera exhibit's narration was made (`tools/narration.py` there; the key is in the
laptop's environment). Its timestamps give each word a time, so a line draws on as its word is spoken. Until the
voice is recorded, the browser's own speech stands in.

**The voice** (Stewart, 20 October: "closest to David Attenborough, or just a good documentary voice"): "David -
Documentary", ElevenLabs voice `ppLqTilh7rH7fbUVlXsf`, in Stewart's account. A first reading of the cold open's
first two paragraphs (`eleven_multilingual_v2`, stability 0.55, similarity 0.8, style 0.15) ran 34.6 s for 73 words,
about 127 words a minute, so the whole script of about 2,265 words runs near 18 minutes.

**Chapter 7 gains a sky leaf** (agreed with Stewart, 20 October): Pillar 43, the Vulture Stone, laid over the sky
`@seked/sky` computes for Göbekli Tepe, as Sweatman and Tsikritsis read it (the vulture as Sagittarius, the
scorpion as Scorpius, 10,950 BC; Collins reads the vulture as Cygnus; corrected 21 October from the paper, claim C8), with the claim, its free choices and the reply. See `docs/gobekli-reliefs.md`.

## Building on what exists

- **`apps/walk`** is the base: its WebGL panorama viewer, the five eras per station, `stations.json`, the tour's
  stops, the detail patches, and `overlays.json` (3D lines in project metres, projected from the station camera).
  It becomes `apps/exhibit`, split into modules under Vite so it can import `@seked/claims`, `@seked/sky` and the
  story page's widgets.
- **`render/films.json` and `render/build.py --film`** render flights already (Catmull-Rom paths through project
  coordinates). A script writes the flight between two leaves from their stations' cameras and views.
- **`apps/story/src`**: the sky, profile, depths, timeline, map and method widgets and the receipts become the
  exhibit's panels and in-scene figures. The scroll page itself is retired.
- **`docs/script.md`** is cut into leaves: one or two sentences each, about 40 leaves for the ten chapters.

## The leaves file

`apps/exhibit/leaves.json`: one entry per leaf, the single source the player, the render queue and the narration
are all built from.

    {"id": "ch1-flank", "chapter": 1, "station": "sphinx-flank", "era": "today", "moment": "high-noon",
     "view": {"yaw": 285, "pitch": 10, "fov": 70}, "arrive": "flight" | "wipe" | "cut",
     "say": "The Sphinx was not built. It was carved, by cutting a ditch around a knoll of bedrock.",
     "draw": ["flank-profile"], "hold": 2, "interact": "look" | "era" | "sky" | "object:head",
     "receipts": ["W1"], "reply": "ch1"}

`scripts/exhibit_queue.py` turns it into the render queue (each leaf's panorama in its era and moment, each flight
between consecutive leaves), so adding a leaf never means writing a render by hand.

## Who does what

- **The laptop's GPU** renders every panorama, flight and sequence, overnight through `scripts/job.py`. It costs
  nothing but time: a panorama takes 2 to 10 minutes, a flight about 30 to 60.
- **The API key** (about $86 on 20 October, $18 kept in hand) runs the headless builder for the code: the player,
  the leaves, the queue script, the narration script. It works down `docs/exhibit-build.md` in its own worktree on
  its own branch, and the laptop session merges. About five chunks.
- **The interactive session** directs, looks at every render and every leaf, decides, and keeps its own turns light
  while the plan's weekly quota is near its ceiling.
- **ElevenLabs** voices the leaves once their text is settled.

## Order

1. **The prototype: chapters 0 and 1**, the cold open and "Older than it should be". It is the first thing anyone
   sees and it uses every kind of moment: a flight in over Nazlet el-Samman to the Sphinx, the flank station, the
   enclosure wall wiped from today to the long rains to the First Time, the profile drawn on, narration. Stewart
   judges it before the other chapters are built.
2. Chapter 2 (the lion and Leo, the head in the hand) and chapter 5 (the sky, the slider on the real sky), the two
   showpieces.
3. Chapter 6 (the numbers, the pyramid in the hand), then 3, 4, 7, 8 and 9.
4. Narration recorded, the trailer captured, the site deployed (Stewart's say-so).

## Added 20 October, from Stewart's questions

- **The world's pyramids, on a globe and a timeline** (a closing leaf of chapter 9, or a side room). Every known
  pyramid and pyramid-like monument imported from a dataset with its date range and coordinates (never typed), on
  a turnable globe and a timeline. The claim drawn as its proponents draw it: the best-fitting great circle through
  the sites, with each site's distance from it. The reply drawn beside it from the same data: the same fit for
  random sites in the same latitude band, so the visitor sees how close "a line" comes by chance, and the dates
  spread over four thousand years.
- **"How deep has anyone looked?"** On chapter 8's depth scale, beside each claimed depth (the Khafre wells to
  648 m, the Hawara walls at 8 to 12 m, the paw cavity), a bar for how deep anyone has actually drilled, dug or
  surveyed there and who did it, each from its source: the 2008 groundwater boreholes at the Sphinx, Petrie's pits
  at Hawara, the radar's own stated reach. Stewart's point, that the official checks stop short of where the
  claims begin, is then shown by the data rather than asserted, and where a check did go deep enough, that shows too.
- **Chapter 6: how they did the math** (agreed with Stewart). A leaf that shows what the Egyptians are known to have
  computed, from their own texts: Rhind papyrus problem 56, a seked worked in the scribe's steps, beside our
  pyramid, then the 5½-palm seked turning into 2π (perimeter over height, 2 x 22/7) and φ as the visitor watches,
  A3's receipt live ("holds, 0 free choices"). Then the north alignment as a method, not a formula: the two stars
  lining up over the pole (Spence 2000) and the equinox shadow, with the drift of successive pyramids' errors that
  dates them. Then the engine's sorting made visible: claims that hold with no free choices, claims that hold only
  after choosing units (B3, the speed of light), claims that fail (D1). The honest gap goes in the words: no
  mathematical papyrus survives from the pyramid age itself; ours are 700 years later.
- **The tone: settled, reported, claimed, and what each would change** (Stewart: not a steelman of a conspiracy
  theory, but fair to the fact that the official account waits for hard evidence and so lags the edge). Every
  claim the exhibit shows carries how far its evidence has got, in plain words from its tier (dug and dated;
  measured by an instrument and published; reported but not yet published or replicated; told), and for a claim
  that is reported but unproven, one line on what it would change if it held up, as Göbekli Tepe changed the
  order of farming and monuments. The Khafre scans are the model case: preliminary, contested, the paper behind
  the method retracted, and if even part of it held, a rewrite of the plateau's history.
