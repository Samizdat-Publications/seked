# The next round

Two tracks: filling the four holes left in the geometry, and making the scene
beautiful. They meet in the middle, because a hole filled with a good model is
both.

The project's purpose was restated on 2026-09-16 and it sets the priorities
below. Seked is a test of how beautiful a fully Claude-driven scene of the
plateau can be, "as close to survey as we can get, with the holes filled in".
The pyramids, inside and out, stay as near survey as the sources allow,
because the claims are tested against them. Everything else needs its place
right, which the OpenStreetMap registration already gives to about a metre,
and may take a good free model fitted to its footprint.

## Part 1. Reading drawings (agreed)

Agreed 2026-09-16 and written into CLAUDE.md's honesty rules.

**Transcribed from a plate.** A dimension printed on a drawing is text on a
plate: entered as printed, the plate cited, `verified: true` once checked
against the image.

**Scaled from a plate.** A distance measured against the drawing's own scale
bar: `method: "scaled from plate"`, the plate and the bar named, a sigma that
sums the scan's pixel resolution through the scale, the drafting tolerance
(half a millimetre on the sheet unless the author states one), and the scan's
shrinkage (how far the scale bar deviates from its nominal length). Never
verified, because verified means checked against a stated figure.

Still forbidden: a coordinate guessed from the look of a picture.

### The tool to build first: `scripts/plate.py`

Built 2026-09-16. One finding from its first use: the Parte IV plates' page
sizes in the archive.org PDF are the sheets' true sizes, which is how Tav. 3
reads as 1:200 and Tav. 5 as 1:50 and how the drafting term is got.

Standard library plus `pymupdf`, which is installed and renders PDF pages
without poppler (the reason the Read tool could not show a PDF).

1. `render` a page to PNG at a stated DPI, cached outside the repo.
2. `grid` a crop with a labelled pixel grid burned in, so points are located
   by reading the grid.
3. `scale` from the two pixel ends of a scale bar and its printed length:
   metres per pixel, and shrinkage against nominal.
4. `measure` pixel points into metres with the three-term sigma, printed as a
   ready-to-paste record.
5. `register` a plan onto the frame from control points, with the same
   least-squares rotation and translation `scripts/footprints.ts` fits OSM with.

## Part 2. The four holes

All sources below were checked on 2026-09-16 and download without a login.

### 1. The well shaft and the grotto (Great Pyramid). Done 2026-09-16.

Smyth turned out to measure only the mouth, and the archive.org item named
below as Parte IV's text is its plates volume. The plates were enough:
`data/measurements/g1-well.json` holds the five legs as Maragioglio and
Rinaldi print them on Tav. 3 and Tav. 5, the two slopes they do not print
scaled with `scripts/plate.py`, and the outlet 7.62 m up the descending
passage. The last leg is solved onto that outlet and checked against the
plates' own 9.50 m at 75 deg: it comes out 9.72 m at 64.9 deg, a miss of
1.3 m in the section, inside what the scaled angles allow, plus 1.7 m east
to west that the section cannot show. What was planned:

Petrie declines to measure it (section 46) because Smyth already had, so the
source is **Smyth, *Life and Work at the Great Pyramid* (1867), vol. II**:
archive.org `lifeandworkatgr02smytgoog` or `in.ernet.dli.2015.181325`, both
with a text layer. This is probably text and needs no drawing work. Cross-check
against **Maragioglio and Rinaldi, Parte IV**: archive.org
`l-architectura-della-piramidi-menfite-parte-4` (33 MB, text layer), and the
Edgars' plates in `Edgar-1910`.

Built as a fifth bore with the existing `bore()`: inlet at Petrie's measured
mouth (35.37 in from the Gallery's north wall on the west ramp, section 46),
legs from Smyth. Its check comes free: the last leg must arrive on the
descending passage's floor.

### 2. Khafre's casing cap (Second Pyramid)

Done 2026-09-16, from text and not a plate. Maragioglio and Rinaldi's Parte V
text, p. 51, has the casing standing "per un'altezza di 40-45 metri a partire
dalla cima", and Perring's table in Vyse's Appendix, p. 117, has "from present
top to bottom of casing from 130 to 150 ft" and Khafre's present height, 447 ft
6 in. `g2.casing.cap.depth` and `g2.height.today` carry them (with Menkaure's
present height from p. 120), and `blender/render.py --state today` draws the
pyramids as they stand, Khafre's cap over his core. What was planned:

**Maragioglio and Rinaldi, *Tavole* 5,2 (1966)**: archive.org `Maragioglio_5-2`
(73 MB). Read the Parte V text volume already cited in the database first, in
case the course or level is stated in words; otherwise scale it off their
elevation. One record, `g2.casing.cap.lower_edge.up`, and the material split
by height the generator already does for Menkaure's granite. This is also a
visible win: Khafre's white cap over the stepped core is the silhouette people
recognise.

### 3. Placing Menkaure's chambers (Third Pyramid)

Route done to the large chamber on 2026-09-16, from text rather than the
plates: Perring's chain in Vyse's Appendix and Maragioglio and Rinaldi's
description (pp. 39 to 43) laid end to end, with `<member>.step` records and the
route in `interiors.ts` and `seked_data.py`. Tav. 4's printed levels became the
check instead of the input: the large chamber's floor comes out at -10.59 m
against its [10.55]. Carried on the same day to the granite crypt (C), through
a corridor whose slope is scaled from Tav. 6 (27.5 ± 1.8°): its floor lands at
-15.27 m against [15.55]. The chamber of the niches (W, [16.95]) was routed
the same evening, as a branch: the stair (P) records the step of the
horizontal passage it opens off and how far back from that passage's end its
door stands, and the room records the bearing of its own north and is laid out
square to itself and turned onto the site. The sense of the turn was never in
doubt once Perring's table was read from the page scan rather than the OCR:
Vyse's Appendix, p. 123, has the room "25' east of north" and his narrative,
p. 85, "25° east of north", and Tav. 4, fig. 6 draws the same, the west wall
leaning east of the north arrow by 23.7° when scaled, with Perring's [25°]
printed between them. So the room is turned clockwise, away from the crypt,
which is the reason Maragioglio and Rinaldi give for the turn. The same page
gives the stair's run, drop and width and the room's plan and height; the
door's place along the passage (2.37 ± 0.22 m back from the crypt's east wall),
the stair's bearing (24.1 ± 1.3°) and its height (1.36 ± 0.27 m) are scaled
from Tav. 4, figs. 5 and 6. Petrie's doorway in the room's south wall, 38.0 to
73.9 in from its east side, then puts the stair's west wall within 2 mm of the
room's, as the plan draws them, which nothing forced. The floor lands at
-16.26 m against [16.95], 0.69 m high: 0.28 m is the crypt's miss carried on,
and the other 0.41 m is Perring against himself, his table putting the room
3 ft 3 in below the passage where the plate's two levels, both his, put it
1.40 m below the crypt, whose floor the section draws level with the passage.
What was planned:

**Maragioglio and Rinaldi, *Tavole* 6,2 (1967)**: archive.org `Maragioglio_6-2`
(92 MB). Second reading: Perring's "Sections of Apartments in the Third
Pyramid" in Vyse vol. II (`operationscarrie02howa`, plate at p. 81). Reisner's
***Mycerinus* (1931)** is free from Harvard's Digital Giza (link below) for
the temples.

Needs one new mechanism in `packages/geometry/src/interiors.ts`, mirrored in
`blender/seked_data.py` with a parity test: a **route**. Each member carries
`<member>.step`, its order from the entrance; a passage that turns carries a
`.direction` azimuth, which discovery already reads; a member with no stored
start begins at the previous member's exit, and a chamber is entered on the
wall facing the arriving passage at the offset the plate gives (several such
door offsets, "from the east wall", are already recorded from Petrie).

The check: Vyse's chain distances, already entered and never used, must come
out of the built route (104 ft down the corridor, 4 ft 3 in to the anteroom,
13 ft 5 in to the end of the portcullises, 41 ft 3 in to the large apartment).

### 4. The mastabas. Downgraded.

Form done 2026-09-16: Reisner's Appendix A gives the Western Field's core
mastabas a "general batter" of 73°37′ to 77°19′ and stepped courses about 35
cm high. `tier3.mastaba.batter` (74.8°) draws every OSM mastaba outline with
its walls leaning in (a `batterKey` on the footprint, mirrored in Python), and
`tier3.mastaba.course.height` bands their stone in the renders. Heights are
still the single 4 m estimate. What was planned:

Survey heights for 577 tombs are no longer worth chasing: they are not
pyramids, and their placement is already right. The plan now is a plausible
field rather than a surveyed one:

- **Reisner, *A History of the Giza Necropolis* I (1942)**, free from Harvard's
  Digital Giza (link below), gives typical core-mastaba proportions by
  cemetery. Use them to set a height per cemetery class, or to scale a height
  from each outline's footprint, as a labelled estimate.
- Give the mastabas real form in the visual track (a battered stone core with
  a stepped or cased face), instances of one or two good models fitted to
  each outline rather than extruded boxes.

## Part 3. The visual track

The standard is the one Stewart set: stunning, well textured, with light and
atmosphere worth looking at. In order of return on effort:

First pass done 2026-09-16: `blender/textures.json` names four CC0 Poly
Haven sets (core, casing, sand, gravel) and `python scripts/textures.py`
fetches them; `render_materials.py` box-projects them at two scales with block
tones and weathering, falling back to the procedural stone when they are not
fetched. `render_sky.build_atmosphere` adds a haze and a low dust layer, made
invisible to shadow rays so they do not dim the sun twice (shadow linking does
not reach volume attenuation in Blender 5.1). Still to do: displacement on the
stepped core, Aswan granite and basalt textures, and the mastabas.

1. **Materials.** Replace the flat procedural colours with PBR texture sets
   (base colour, roughness, normal, displacement) from CC0 libraries,
   **Poly Haven** and **ambientCG**, both downloadable by API without an
   account. Tura casing (fine white limestone), nummulitic core (coarse,
   pitted, with course lines and block joints), Aswan granite, basalt paving,
   and sand with wind ripples. Weathering by height and exposure. Displacement
   on the "(today)" core, where Petrie's measured courses already give the
   steps, so each course reads as blocks and not as slabs.
2. **Atmosphere.** Aerial perspective and haze so the far pyramids sit back in
   the air; a volumetric dust layer low over the sand at dawn and sunset;
   filmic tone mapping tuned per view. The physical sky and the baked sun are
   already right; this is what makes them look it.
3. First stand-in done 2026-09-16: `blender/models.json` and `scripts/models.py`
   (Sketchfab API, Stewart's token) and `blender/render_standins.py`, which fits
   a model to the OSM outlines it replaces at render time and hides them. The
   Sphinx is the Watt Institution's scan of an 1903 bronze, so it is buried to
   the chest. Replaced the same evening (snapshot 0022) by a model Meshy
   generated from four CC0 photographs (`scripts/meshy.py`, Stewart's key),
   since no scan of the excavated Sphinx can be downloaded; the bronze is kept
   in the manifest as `retired`. The manifest lives in blender/, beside
   textures.json, rather than in models/ as planned.
   **Stand-in models for everything that is not a pyramid**, from free
   sources, each fitted to its OSM footprint (centroid, principal axis for
   orientation, a scale check against the outline) and recorded in a
   `models/manifest.json` with URL, licence, attribution and the footprint it
   is fitted to. Candidates: the CC-BY photogrammetry scans of the Sphinx and
   the Great Pyramid already named in docs/plan.html (Sketchfab), and free
   temple and mastaba models. Sketchfab downloads need an account; if a model
   is wanted from there, Stewart downloads the file and it goes in the
   scratchpad.
4. Done 2026-09-16: the bake exports `stars.icrsToEnu` (tested against the
   baked stars), and `render_sky.build_milky_way` turns NASA's
   milkyway_2020_8k.exr (source nasa-svs-4851, fetched to build/sky/) by its
   transpose. Checked by swapping in NASA's constellation figures: figure
   vertices land on the HYG stars except where proper motion over 4,450 years
   has moved them. **The sky.** The HYG stars are placed by the sky package and stay the
   measured layer. Add a Milky Way background from a public-domain
   equirectangular map (NASA's Deep Star Maps), rotated by the same precession
   the stars use so it cannot disagree with them.
5. **Hero renders and the film**, re-rendered at the end of each step above,
   logged in `docs/progress/log/`, with milestone snapshots in
   `docs/progress/`.
6. **The viewer**, fed the same textures through glTF with KTX2 compression
   (gltf-transform), as docs/plan.html always intended, so the browser is not
   the poor relation of the renders.

## Part 3. The plateau as it was built (asked 2026-09-16)

Stewart, 2026-09-16: the end result models the plateau as it stands today
and also pristine, as first built: polished limestone casing, the apex stones,
everything fully modelled, and the Sphinx "back when it was a lion". More
creative liberty is allowed here than for today's state, because less
survives, and every piece is said to be a reconstruction.

What already exists: `render.py --state built|today`. `built` is only the
three pyramids' geometry, cased and pointed, from the database. The rest of
the scene has one state, today's.

What `built` has to become, most visible first:

1. **The casing as finished.** Polished Tura limestone as a material of its
   own, near white, with a sheen that catches the sun, fine joints and none of
   the weathering the today textures carry; Aswan granite where the records
   say (Menkaure's lower sixteen courses, Khafre's first). Geometry already
   comes from the database.
2. **The pyramidions.** Khufu's and Khafre's are lost. Surviving ones fix the
   form: Amenemhat III's black granite pyramidion from Dahshur (Cairo), the
   limestone one of the Red Pyramid, and the one found in 1992 at Khufu's
   satellite pyramid G1-d, the only pyramidion from Khufu's complex. Sized
   to each pyramid's apex from the database's own slope, so the cap cannot
   disagree with the angle. Plain stone by default; a gilded cap is later
   tradition and goes in as a switchable variant at the `claimed` tier.
3. **The Sphinx as carved, c. 2500 BCE.** Nose, uraeus and beard (the
   fragments in the British Museum and Cairo fix the beard's form), the
   nemes striped, the traces of red paint on the face, no scaffolding and no
   Graeco-Roman or modern repair masonry; the Sphinx Temple whole in front.
   Stand-in from Meshy (text and image prompts from CC0 photographs of the
   beard fragment and the head), fitted to the same outline.
4. **The lion Sphinx, as a claim.** A recumbent lion with a lion's head in
   proportion to the body, for the hypothesis that the present head was
   recut from one (Temple, Schoch, Hancock and Bauval; C5). It is a
   `claimed` structure in `data/structures.json`, drawn as a claim, switched
   separately (`--sphinx carved|lion|today`) and never the default.
5. **The complexes whole.** Valley and mortuary temples roofed and walled,
   the causeways covered, the enclosure walls, the queens' pyramids cased,
   boat pits closed, the harbour basin in front of the valley temples. On
   their OSM outlines, from published plans where the plans exist (Hölscher
   and Ricke for Khafre, Reisner for Menkaure, Lehner's AERA plans), Meshy
   stand-ins where they do not, every one labelled a reconstruction.
6. **The ground.** The quarries unexcavated or open as the builders left
   them, the Sphinx's enclosure cut, no modern road, village or car park.

Added the same night: `--state ancient`, the built plateau with a freshly
carved recumbent Anubis as its Sphinx (Temple's reading, which Stewart preferred
to the lion for the long forepaws), and a freshly carved lion beside it to
choose between by rendering both. Weathered versions of both stand in today's
state. **Later, Stewart's idea:** intermediate Sphinxes between the freshly
carved one and today's, showing the erosion and the recutting of the head over
time (for the proponents' sequence, lion or jackal to an older face to the
present one), each restored from the stage before it so the body stays one body.

The state and the epoch stay independent. The epoch is a choice for the sky,
the state a choice for the buildings, so a render or the film can show the
built plateau under the sky of 2450 BCE or of 10,500 BCE, or the lion Sphinx
under either, and the caption says which of those is a claim.

## Order of work

Done on 2026-09-16: the hero film (snapshot 0016), the well shaft (from the
plates, not Smyth), `scripts/plate.py`, Khafre's casing cap (from text), a
first materials and atmosphere pass, the first stand-in (the Sphinx), and the
Milky Way (snapshots 0017 to 0020). What is left, in order:

1. Menkaure's chamber of the niches, a branch off the route. Done 2026-09-16:
   turned 25° east of north (Vyse, and Tav. 4's plan), its floor 0.69 m above
   the printed [16.95].
2. Mastaba heights by cemetery (hole 4), and more stand-ins: the temples
   (Meshy from photographs, as the Sphinx was), and the Sphinx's enclosure cut
   into the ground, which the sand still fills up to its flanks.
3. The second materials pass: displacement on the stepped core, granite and
   basalt, the mastabas' stone.
4. The viewer's textures, and the film re-rendered over the new materials and
   the Milky Way. Done 2026-09-16 (0023).
5. Part 3, the plateau as built: casing and pyramidions first, then the
   carved Sphinx and the lion variant, then the complexes and the ground.
   Done 2026-09-16 and 17 as far as Blender goes (snapshots 0024 to 0027):
   pristine casing and caps, the carved, lion and Anubis Sphinxes fresh and
   weathered, L.VII.C's reconstruction for the complexes, the enclosure cut,
   and `--state ancient`. On 2026-09-17 Stewart chose the ancient Anubis's
   finish: matt black all over (the Meshy retexture `paint-black2`, named in
   `finish_in`), its gold leaf made metallic at render time by `add_gilding`.

Still open from this list: stand-ins for the temples and mastabas of today's
plateau (item 2), the second materials pass (item 3, and the reconstruction's
parts, which are still flat colours), and Stewart's intermediate Sphinxes.

**Planned and started the same day.** The design is
`docs/superpowers/specs/2026-09-17-realtime-plateau-design.md` (four states on
one timeline, the look of each, where every asset comes from, Blender as the
asset baker) and the first plan is
`docs/superpowers/plans/2026-09-17-stage-1-light-air-stone.md`. Stage 1 landed
on 2026-09-17 (snapshot 0028): the sun of any moment from the sky package, a
physical sky, air, shadows, stone with relief and the post chain; the new
interface; the fitted stand-ins exported from Blender and loaded in the
browser; the builders for Stage 2. Open from Stage 1: the course joints from
the real courses (a mean is used), the render's low dust layer, the section
cut's drawing treatment, the queens' slope and the enclosure keys the builders
wait for.

Stage 2 landed the same evening (snapshot 0029, plan
`docs/superpowers/plans/2026-09-17-stage-2-states-and-timeline.md`): every
structure in its four states from the geometry package's builders, Khafre's
enclosure wall from Petrie's section 71, the pristine casing with its
surveyed joints and electrum caps, the Sphinx per state with the lion and
Anubis claims switchable, the enclosure trench cut into the ground (margin a
look choice: the ARCE Sphinx Mapping Digital Database on Open Context, CC BY,
has the 1:50 plan to scale it from), burial to the neck in `stripped`, the
dissolve between stops, the loading line, the air per state and hover tags.
A moment's day now counts from the March equinox of its own epoch, since the
proleptic calendar's 21 December had drifted months from the solstice by
10,500 BCE. Still open from stage 2: the queens' slopes (Petrie states none;
Lehner 1997 is not readable here), Khufu's and Menkaure's enclosures, the
akhet moment rendering dark at sunset, the heavy haze at aerial stands, the
polished casing's cool cast toward the sun.

Stage 3 landed the same night (snapshot 0030, plan
`docs/superpowers/plans/2026-09-17-stage-3-the-first-time.md`): the harbour
and the flood plain, the green mask and the plant scatter, a second light
and air pass (sunset legible, dust low, a ground in the reflections, the
night by starlight), a props pipeline (`blender/props.json`,
`scripts/props.py`, `scene/Props.tsx`) with the seated Khafre, the jackals
and the plants, and two plans read: the ARCE 1:200 map of the Sphinx ditch
(Open Context, CC BY, `arce-sphinx-mapping-oc`; north and west margins
scaled) and Hoelscher's Blatt XVII of the valley temple (Heidelberg IIIF,
`hoelscher-1912`; the hall, pillars and floor levels). Open from stage 3:
the hall's 23 statue sockets and east entrances, the T's north-south arm,
Reisner's Menkaure plans, a mesh for Khufu's ship, the water at dusk, and
Stewart's reference look (spec 3.1) as the yardstick for the next pass.

Stage 4 landed later the same night (snapshot 0031, plan
`docs/superpowers/plans/2026-09-17-stage-4-motion.md`): a motion engine
(`apps/web/src/motion/`: eased keys, camera arcs that clear the plateau, a
shot applied through the view store's own actions, two clocks), the tour
rebuilt as eleven shots through the eras with narration over the stage
(`tour.ts`, `sequences.ts`, `ui/Tour.tsx`, `ui/Narration.tsx`), a film
exporter that steps the clock frame by frame at any size into an mp4 with
subtitles (`apps/web/src/film/`, `ui/Film.tsx`), and the scene held up under
motion (the sky's reflections rebuilt only when the sun has moved, LOD
hysteresis, vegetation dissolving with the rest, water and haze cleared at
dusk from low stands). The ground's cut uniform is now a fixed capacity,
after a cached program read past a shorter array during a film. Open from
stage 4: the built and ancient states draw at about 5 fps at 1600 by 900 on
the 5070 Ti against about 180 in today, so the wall-clock tour needs a cost
pass before it reads as motion; the water's flat edge at the horizon from
the night stand; the frame rate of the film run (about 4 frames a second at
1080p in the heavy states) is the same cost.

Stage 5 is planned (`docs/superpowers/plans/2026-09-18-stage-5-claims-and-the-runner.md`,
written 2026-09-18, to be run by an Opus 5 session). The cost was found
first: the scattered acacia stand-in is instanced 700 times at 169,160
triangles each, about 118 million triangles a frame, because the asset
baker's coarsest ratio level stops at its error bound on a mesh that dense;
hiding the 700-instance plants takes the built state from 5 to 78 fps.
Track Q bakes the plants to a triangle budget, draws the far ring as cards
and casts shadows only near; R and S put the claims drawer and every
overlay in the new look with a style for a proposed claim; T is
`@seked/runner`, prose to a claim file by structured outputs on
`claude-opus-5`, checked against the expression language and graded by the
evaluator, with a CLI that writes to `build/claims/` and never to `data/`;
U mounts it in the viewer with the reader's own key.

Stage 5 landed on 2026-09-18 (snapshot 0032, same plan, director plus five
Opus tracks in worktrees). The heavy states are light: the scattered plants
are baked to a triangle budget rather than a ratio (the acacia's coarsest
level was 169,160 triangles and is now 3,341), the ring past 900 m is a cross
of two cards rasterised from the plant's own textures with a 60 m hysteresis
band, and only the plants inside the first shadow cascade cast. Measured on
the merged tree at 1600 by 900, built runs 110 to 192 fps and ancient 70 to
162 across the five hero looks, against a bar of 45 and against 4 to 8 the
day before; the tour plays on the wall clock and a film records at about 84
frames a second where it managed 4. Diagnosing it found a second fault worth
as much: the plants were shrunk to nothing past 400 m in the vertex shader
rather than skipped, so the savanna was paid for and never seen. The flood
plain's hard edge at the night horizon now dissolves into the atmosphere's
own in-scatter where the water leaves the terrain. The claims drawer grades
by a dot and a word and reads top down; every overlay is drawn in one palette
(lapis for what a claim asserts, the warm sand for the survey it is asserted
against, green and red only for the ring that says whether it fits), with a
proposed claim dashed and prefixed. `@seked/runner` turns prose into a claim
file on `claude-opus-5`, checks every identifier against the environment
before grading anything, repairs once, and is graded by the same evaluator as
the filed claims; the CLI writes `build/claims/` and there is no argument that
could aim it at `data/`.

Open from stage 5, in the order they matter:

1. **Nobody has put a real proposal to the model.** There is no
   `ANTHROPIC_API_KEY` in the environment or in `~/.seked/keys.env`, so
   `pnpm claim -- --example 1`, the viewer's own round trip and the prompt's
   token count are all still to be done. Everything behind the key is covered
   by tests with a fake client, which is not the same thing.
2. Two assets whose levels do nothing, the same fault track Q fixed for the
   plants: `khafre-seated`'s lod1 and lod2 are both 316,745 triangles against
   lod0's 359,327, and `boulder`'s are 62,272 against 66,122. That is
   `Props.tsx`'s cost and it is not yet paid for.
3. `island-tree`'s leaf material is `BLEND` with a three-channel JPEG, so the
   leaves carry no alpha at all and draw as solid quads.
4. The island tree and the date palm miss their triangle budgets (3,341
   against 3,000; 5,090 against 2,500) because a frond and a leaf card are
   separate shells and the simplifier will not collapse a shell's border.

**Where this goes next (Stewart, 2026-09-18).** Two directions, in this
order, both settled with him on the day stage 5 landed and both about content
rather than the renderer. The viewer already runs on the GPU through WebGL2;
a desktop build would buy lower draw-call overhead and no download ceiling
but would not buy the picture, and WebGPU (`WebGPURenderer` and TSL, already
in the three version this uses) is the better lever when the scene is
actually GPU-bound, which after stage 5 it is not.

1. **The modern city.** The `today` state needs Giza and Cairo behind it, the
   valley green and the Nile east, which is what makes the then-and-now read.
   `scripts/footprints.ts` already asks Overpass for every way in its bbox and
   then keeps only what is ancient, so the city is downloaded on every run and
   discarded: widen the bbox east and north (the city runs to about 31.21 E
   against the present 31.145), add a `city` kind with height from `height` or
   `building:levels`, merge them the way the 577 mastabas already are, and
   gate them to `today`. CLAUDE.md now carries the carve-out this needs: the
   city is context, not evidence, and an untagged storey height is a look
   choice rather than a measurement key.
2. **The architecture pass.** The ancient state's temples are extruded
   footprints, and Stewart's reference is a reconstruction with fluted
   columns, an architrave and cornice, a decorated facade, a roofed causeway
   and a quay. That is parameterised builders in `@seked/geometry` beside
   `templeMesh` and `enclosureWallMesh`, labelled reconstructions like
   everything else. It is the bigger job and it is second because the city is
   the cheaper change and the more visible one.

**Where this goes (Stewart, 2026-09-17).** The end is a fully 3D,
realtime plateau in the web viewer, as beautiful as it can be made, in its
modern and ancient states and the transitional steps between, with models
downloaded or generated for every building if that is what it takes. The
Blender renders proved the look; the next phases carry it to realtime. Those
phases are to be planned, not assumed from this list.

## Links

- Reisner, *A History of the Giza Necropolis* I, free, no login (262 MB):
  https://d1g9lvwdq3dcse.cloudfront.net/images/MFA-images/Giza/GizaImage/full/library/reisner_gn_books/giza_necropolis_1/giza_necropolis_1.pdf
  (listed at https://giza.fas.harvard.edu/pubdocs/128/full/)
- Reisner, *Mycerinus: The Temples of the Third Pyramid at Giza*, free, no
  login (179 MB):
  https://d1g9lvwdq3dcse.cloudfront.net/images/MFA-images/Giza/GizaImage/full/library/reisner_gn_books/mycerinus/reisner_mycerinus.pdf
  (listed at https://giza.fas.harvard.edu/pubdocs/130/full/)
- Maragioglio and Rinaldi: https://archive.org/details/Maragioglio_5-2 ,
  https://archive.org/details/Maragioglio_6-2 ,
  https://archive.org/details/l-architectura-della-piramidi-menfite-parte-4
- Smyth: https://archive.org/details/lifeandworkatgr02smytgoog

Nothing in this round needs anything from Stewart unless a Sketchfab model is
wanted.
