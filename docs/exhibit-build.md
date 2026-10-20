# The exhibit build: the running list

The headless builder's list for `apps/exhibit` (plan: `docs/exhibit-2026-10.md`). Started 20 October 2026 by the
laptop session (`laptop-lead`), which renders, looks and merges. The builder works in its own worktree
(`build/wt-exhibit`) on branch `claude/exhibit-builder`; its spend is in `docs/exhibit-build-ledger.md`.

## Rules

- The prototype is **chapters 0 and 1**. Stewart judges it before the other chapters are built, so make those
  two read beautifully end to end before widening anything.
- `apps/walk` is the base and stays working until `apps/exhibit` replaces it; do not break `/walk`.
- The panoramas are on disk in `apps/walk/pano/` (gitignored; your worktree reaches the laptop's through a
  junction). The First Time and the long rains are being re-rendered tonight without pyramids
  (`render/queues/exhibit-claim-eras.json`); use what is there and do not depend on the old ones' look.
- `apps/story` is retired. Take from it what serves (the widgets, receipts, the bundle loading, `autoplay.ts`'s
  pure-function-of-time idea); do not extend it.

## Items

- [x] **E1. `apps/exhibit`, the player ported.** A Vite + TypeScript app (no React, as `apps/story`), served at
  `/exhibit/` by `pnpm site` beside `/walk/`. Port `apps/walk/index.html`'s WebGL2 panorama viewer into modules:
  equirectangular panoramas centred on true north, drag and wheel to look, the detail patches, the registered
  overlays (`overlays.json`, 3D lines projected from the station camera). Panoramas load from the same files
  `/walk/` uses. Full screen, nothing but the picture and a quiet caption band. Tests for the projection maths.
  *Done 2026-10-20 15:49 UTC, `f499c90`.* `apps/exhibit/src`: `projection.ts` (the maths the shader and overlay
  share, 19 tests), `manifest.ts` (stations and overlays read tolerantly, 7 tests), `viewer.ts` (the WebGL2
  shader, two layers a and b ready for E4's wipe), `textures.ts` (fetch, decode, upload, oldest-used evicted),
  `overlay.ts` (lines draw on, labels one at a time, the walk's label plate), `stage.ts` (drag, pinch, wheel,
  arrows, inertia, patches, flat fallback without WebGL), `main.ts` (the address picks the shot until E2). Looked
  at at 1440 by 900 and 390 by 844: `sphinx-flank` today, and `south` built with `g1-proportions` registered on
  Khufu's edges; drag, zoom and resize checked. `pnpm site` builds it into `site/exhibit/`; `pnpm typecheck`
  covers it. `pnpm test` 1118 passed. `render/tests` has 2 errors that need gitignored build outputs this
  worktree lacks (`build/sky-bake.json`, `build/textures/index.json`), not this change.
- [x] **E2. The leaves.** `apps/exhibit/leaves.json` with the schema in the plan ("The leaves file"), a loader that
  validates it (zod, as `@seked/data`) and tests. Cut chapters 0 and 1 of `docs/script.md` into leaves, one or
  two sentences each, every word of those chapters kept in order. Choose each leaf's station, era, moment and
  view from `render/stations.json` so the story is told by where we stand: the cold open from the east over
  Nazlet el-Samman to the Sphinx's face at dawn; chapter 1 at `sphinx-flank`, the ditch wall. Follow the plan's
  rule: two leaves joined by a flight share an era and a moment. Log each choice.
  *Done 2026-10-20 15:56 UTC, `4977e37`.* 22 leaves (chapter 0: 9, chapter 1: 13) in `apps/exhibit/leaves.json`;
  `src/leaves.ts` (zod schema, join rules, the panorama a leaf needs) with 12 tests, one of which compares the
  leaves' words with `docs/script.md` word for word. Cold open: `sphinx` (above the Sphinx temple, looking west at
  the Sphinx before Khafre) for the first two sentences, a flight to `sphinx-face` on "Behind it stand the
  pyramids", wipes there to built on "2500 BCE", to the First Time on "10,500 BCE" and back to today on "So how
  old is the Sphinx?". Chapter 1: a flight to `sphinx-flank`, turns between the south wall (fissures, yaw 235),
  the body's beds (yaw 340), the floor (pitch -30) and east along it, wipes to the long rains on "so the front
  was cut long before the back" and to the First Time on "about 10,000 BCE", then a turn up to the head. `?leaf=`
  shows a leaf. Every leaf looked at at 720 by 450; two at 390 by 844. All leaves draw nothing yet (E2b).
- [x] **E3. Narrated play.** Play, pause, next, previous, a chapter list. Each leaf speaks its words (the
  browser's `speechSynthesis` until the recorded voice exists, with its word-boundary events as the timing),
  shows them as a caption, holds, then moves on. Any drag or key pauses play and hands the visitor the view;
  play resumes from that leaf. The state is in the address (`?leaf=ch1-flank`), as the Antikythera exhibit's is.
  *Done 2026-10-20 16:02 UTC, `f5e4270`.* `src/player.ts` and `src/play.ts` (9 tests: the script's chapters and
  replies, the voiceless timing, turns, the address). The browser's voice speaks each leaf; its word boundaries
  are kept as `player.words` for E4, with an estimate of 2.5 words a second when there is no voice or it stalls.
  A leaf in the same panorama arrives by an eased turn; wipes and flights cut until E4. Drag, wheel or key pauses
  and keeps the leaf; Play turns back to the leaf's view and speaks it again. Space, PageUp and PageDown; a chapter
  list from `docs/script.md`'s headings. Checked in Chromium at 1440 by 900 and 390 by 844: play ran ch0-dawn to
  ch0-textbooks unattended, a drag paused it on that leaf, the chapter list jumped to ch1-carved. The bundle is
  205 kB (67 kB gzipped), most of it the script, imported whole so chapter titles and replies are never retyped.
- [x] **E4. The changes.** (a) The era wipe in the panorama shader: a hard, slightly soft-edged boundary sweeping
  across the view, the new era behind it; animated in play, draggable when paused. (b) Lines that draw on, each
  timed to the word that names it. (c) Flights: when a leaf arrives by `flight`, play
  `flights/<from>--<to>.mp4` full screen and hand over to the panorama on its last frame, the panorama already
  set to the leaf's view; until a flight is rendered, a `cut`.
  *(a) done 2026-10-20 16:06 UTC, `25de84b`:* the shader draws the new era left of a hard, slightly slanted edge
  with a faint light on it, crossing in 1.8 s once both pictures are in; the player wipes whenever the next leaf
  is the same station and moment in another era. Paused on an `era` leaf, a grip waits at the right edge ("Drag
  for Today") and brings back the era the panorama was last in. Checked mid-sweep and dragged at both sizes.
  *(c) done 16:08 UTC, `4843eb1`:* in narrated play a leaf arriving by flight from its predecessor plays
  `apps/exhibit/flights/<from-leaf>--<to-leaf>.mp4` (gitignored, served at `/flights/`, copied by `pnpm site`)
  over the stage with the panorama already at the leaf's view beneath, and hands over on the last frame; no film
  is a cut. Checked with a throwaway test film. *(b) done 16:10 UTC, `5cfa56d`:* `draw` entries are `name` or
  `name@word`; a cued line waits for its word in play (voice boundaries or the estimate) and draws on; paused it
  is simply there. Checked with a temporary cue on Khufu's overlay. No leaf draws yet (E2b).
- [x] **E5. The receipt and the reply.** A small tab at the edge of the screen on every leaf that has them: the
  claim's receipt computed live from the bundle (port `apps/story`'s receipts), and the archaeologists' reply
  from `docs/script.md`, in a quieter type. Closed by default.
  *Done 2026-10-20 16:17 UTC, `a983cc1`.* `src/panel.ts` (the tab and panel, the reply read from the script by the
  leaf's `reply`), `src/receipts.ts` ported from `apps/story` with its tests, 5 new tests. Opening pauses play;
  the panel follows the leaf; Escape closes. Chapters 0 and 1 name no claim, so the prototype shows the reply
  alone; receipts need the bundle (`pnpm bundle`), absent in this worktree, so their page rendering is untested
  here (the computing is). Looked at open and closed at both sizes. The bundle is now 260 kB (86 kB gzipped).
- [x] **E6. The render queue from the leaves.** `scripts/exhibit_queue.py` writes, from `leaves.json`:
  `render/queues/exhibit-panos.json` (each leaf's station in its era and moment that `apps/walk/pano/` lacks) and
  `render/films-exhibit.json` (a flight for each leaf that arrives by `flight`: from the last leaf's station
  camera and view to this one's, the arriving leaf's era and moment, about 3 s at 30 fps, 1920 by 1080, 64
  samples, a smooth eased path that rises over obstacles). Teach `render/build.py --film` to read a films file
  other than `render/films.json` (`--films PATH`). Unit tests for the path maths; do not render.
  *Done 2026-10-20 16:14 UTC, `cd13e18`.* `scripts/exhibit_queue.py` (stdlib) wrote 5 panoramas into
  `render/queues/exhibit-panos.json` and 2 flights into `render/films-exhibit.json`; `render/build.py --films PATH`;
  `render/publish.py` publishes `<station>-<era>-<moment>.png` for the exhibit outside the walkthrough's manifest.
  7 tests in `render/tests/test_exhibit_queue.py` (naming in step with `leaves.ts`, lens, path, flights).
- [x] **E2b. The flank's lines, first step: the ditch in plan.** *Done 2026-10-20 16:24 UTC, `8c6243f`.* The
  exhibit's own figures (`src/figures.ts`), named in `draw` and cued like overlays; `ditch-plan` draws the statue's
  OSM outline and the ditch's north and west walls at ARCE's two scaled margins with their sigmas, "you are
  here", and a caption that they are scaled and unchecked. The build cuts its data out of `data/`
  (`virtual:sphinx-plan`). `ch1-carved` draws it on "ditch"; 5 tests; looked at in play at both sizes.
- [ ] **E2c. The rest of the flank's lines.** The script's beats also draw the bedding profile (hard beds and
  coves, each bed's hardness sourced or labelled a look choice), the fissures with run-off arrows, seismic lines
  S1 to S4 and S9 on the floor (placed from Reader's Fig. 5, labelled so) and the weathered slab under the floor
  ("by Schoch's account"). None has records yet: the slab needs the proposed
  `sphinx.enclosure.weathering.depth.s1` to `.s4` from `dobecki-schoch-1992` (`verified: false`), the seismic
  lines a reading of Reader's Fig. 5 with `scripts/plate.py`. Enter those records first (never typed into an
  overlay), then draw them, as figures where the statue would hide them in the scene.
  *Blocked 2026-10-20 16:31 UTC on sources:* `assets/plates/` has neither Dobecki and Schoch's figures nor Reader's
  Fig. 5, and the script keeps the *KMT* depths in the notes until the paper's own figures are read. See For
  Stewart.
- [x] **E7. The recorded voice in the player** (replaced by the laptop session, 20 October: the voice is chosen
  and recorded). `assets/narration/chN.mp3` and `chN-reply.mp3` hold each chapter of `docs/script.md` in Stewart's
  chosen voice, and `chN.json` the exact text spoken with every character's start and end time
  (`scripts/narrate_script.py`). A leaf is a range of its chapter's text: find its words in that text, take their
  times, and play that span of the chapter's audio; a line draws on at its word's time. The browser's speech stays
  only as the fallback for a leaf whose words are not in the recording (say so in the console). The leaves must
  keep the script's words exactly, or the chapter is re-recorded. Do not call ElevenLabs.
  *Done 2026-10-20 16:29 UTC, `71c917a`.* `src/narration.ts` finds each leaf's words in its chapter's recorded text
  and gives the span and each word's time (3 tests; one checks every chapter 0 and 1 leaf against the recordings
  when the checkout has them, which this worktree does not, so it skipped here; the same check run by hand
  against the main checkout's files found all 22). The player fetches a chapter's mp3 whole and plays the leaf's
  span from memory (a blob seeks whatever the server does with ranges), cueing lines and figures from the audio
  clock; the browser's voice is the fallback, said in the console. Served at `/narration/` in dev, copied by
  `pnpm site`. Checked muted against the recordings.
- [x] **E8. Look at it end to end** at both sizes, as a visitor with no background would, and fix what reads
  badly. Write what still needs a render or a decision under "For Stewart" and "For the laptop".
  *Done 2026-10-20 16:38 UTC, `17eecf1`.* Played all 22 leaves unattended at 1440 by 900 and 390 by 844, muted,
  with the recordings: 3 min 12 s each, no errors, no fallback to the browser's voice, the ditch plan on its
  word. Fixed: on a phone "Behind it stand the pyramids" showed none (Khafre hidden behind the head at
  `sphinx-face`, Khufu out of frame), so the cold open now keeps the pyramids, the textbook date and the wipe to
  the First Time at `sphinx` and flies to the face on "the rock agrees with them"; `ch0-ditch` faces the flank.
  A test now keeps wipes between eras taken from one camera (the built era at `sphinx` is not). What still needs
  a render or a decision is below.
- [x] **E9. The spoken reply, heard.** `assets/narration/chN-reply.mp3` holds each chapter's spoken reply; the
  reply panel shows its words but cannot play it. A quiet listen button beside the spoken line, playing the file
  while play is paused.
  *Done 2026-10-20 16:39 UTC, `cb71430`.* The Listen button shows once the recording is there, reads Stop while it
  plays, and falls silent when the panel closes or play starts. Checked muted with and without the recording.

- [x] **E10. Framing** (the laptop session's review, 20 October). Most leaves put the subject on the bottom edge
  under two-thirds empty sky (`ch0-sunrise`, `ch0-behind`, `ch0-textbooks`, `ch0-claim`, `ch0-promise`). Frame each
  leaf as a photographer would: the subject on the lower third or centred, the horizon about a third down, sky
  only where it says something (dawn, a storm). Mostly pitch and yaw in `leaves.json`; check each at 1440 by 900
  and 390 by 844 and look at the screenshots side by side before and after.
  *Done 2026-10-20 18:30 UTC, `6b6ebb5`.* Two causes, two fixes. On a wide screen the leaves were simply aimed too
  high: the cold open now looks 4 to 8 degrees lower (the Sphinx and the pyramids in the middle, the horizon near
  40 per cent), `ch0-behind` turns to 298 so Khufu is in frame, the face leaves drop to pitch 18, the ditch walls
  lose 4 to 7 degrees of sky, `ch1-head` is centred on the head. On a phone the widened vertical field split
  evenly above and below and sank every subject under the sky whatever the pitch, so `frameAim` (decision 21)
  keeps the point a shot puts 40 per cent down at 40 per cent on any screen. All 22 leaves looked at before and
  after at both sizes as contact sheets (`build/exhibit-shots/e10/`, `build/exhibit-shots/frame.py`). Left alone:
  `ch0-ditch` (already a good picture; the walls are not in the walkthrough's render from the paws), the floor
  and seismic leaves, and the claim-era leaves at the flank, which must keep `ch1-depth`'s view for the wipe and
  whose panoramas are being re-rendered. `render/films-exhibit.json` regenerated (the flights end on the leaves'
  views). `pnpm test` 1161 passed; render tests the same 2 missing-build-output errors as E1.
- [x] **E11. Sharp at rest: a patch per leaf.** A 4096 by 2048 panorama gives about 11 px a degree, and a desktop
  view at 40° wants about 30, so tight leaves look soft. Use the walkthrough's detail patches: for every leaf,
  `scripts/exhibit_queue.py` also queues a rectilinear patch at the leaf's own yaw, pitch and a field 1.3 times
  the leaf's (2560 px wide, the leaf's era and moment, 96 samples), and the player lays it into the panorama so the
  leaf is sharp at rest and still draggable, the panorama taking over past the patch's edge. The patch must
  register exactly with its panorama (same camera position and sun). Write the queue; do not render.
  *Done 2026-10-20 18:39 UTC, `2b6debe`.* `scripts/exhibit_queue.py` writes `render/queues/exhibit-patches.json`:
  9 patches for the 22 leaves (one per shared view, and only where a patch holds at least 1.25 times the
  panorama's pixels, decision 22), out to `build/render/patch-exhibit/`, each sidecar naming the panorama it
  registers with. `render/publish.py` publishes them into `pano/patch/` and lists them in
  `apps/walk/exhibit-patches.json`, leaving out a patch older than its panorama. The player files every patch
  under the panorama it was rendered with (decision 23), which also stops the walkthrough's midsummer patch for
  `sphinx` today being laid over the exhibit's dawn panorama, and fetches the next leaf's patch ahead. Checked in
  Chromium with a tinted patch reprojected from `sphinx-today-equinox-dawn.jpg`: it registers with no doubled
  edges, covers the leaf at rest, and the panorama takes over at its feathered edge when dragged; a phone's wide
  field never wants a patch, so none is fetched there. 5 new Python tests, 2 TS. The six dawn panoramas had
  landed meanwhile, so the E10 framing was looked at again on them, all 22 leaves at both sizes: it holds.
- [x] **E12. The rooftop of Nazlet el-Samman** (decided by the laptop session: the words stay, and the cold open
  stands where they say). Add a station `nazlet-roof` to `render/stations.json`: on the flat roof of a real
  building in Nazlet el-Samman east of the Sphinx, chosen from `data/footprints/city.*` (its footprint and
  measured height, eye 1.7 m above the roof), with a clear line to the Sphinx's face and the pyramids behind;
  `today`, `equinox-dawn`. Say in `stations.json` which building and its height's source. Make `ch0-dawn` stand
  there and fly (E4c) to the temple view for the next leaves; queue its panorama, patch and flight.
  *Done 2026-10-20 18:45 UTC, `3f282b3`.* `nazlet-roof` stands on Open Buildings record 48821 (a 422 m2 building
  354 m east of the Sphinx, 15 m north of its axis, its height measured by the 2.5D raster), chosen as the roof
  nearest the axis from which lines to the Sphinx's head and chin and to both apexes clear the scene's terrain
  and every drawn building (a throwaway search, `build/exhibit-shots/e12/roofs.py`; the monuments between were
  not checked). The height is typed nowhere: `"roof": true` makes the renderer stand the eye 1.7 m over the drawn
  box there (`city.roof_at`, decision 25), and `render/tests/test_city_roof.py` keeps every roof station on a
  drawn, measured building. `ch0-dawn` stands there (yaw 284, pitch 1, field 40: the Sphinx, Khafre and Khufu in
  one frame, a framing worked out from bearings, to look at once rendered) and `ch0-sunrise` flies from it.
  Until the roof is published, `until` puts `ch0-dawn` at the temple view as before (decision 24): looked at at
  both sizes, and Next turns to `ch0-sunrise` in the same panorama. The queue asks for the roof's panorama and
  patch; the flight `ch0-dawn--ch0-sunrise` waits for the publish (see For the laptop).

- [x] **E13. Chapter 2, "A lion, not a king": its leaves.** Cut chapter 2 of `docs/script.md` into leaves, every
  word kept in order (the narration is recorded: `assets/narration/ch2.json`). Stand where the argument is seen:
  the head against the body at `sphinx-face` today (the head too small), the master lion in the First Time, the
  head in the hand (E14) on "Here the king's head sits inside the lion's", and due east from behind the lion at
  the equinox dawn of 10,500 BCE with Leo on the horizon, the sky drawn live from `@seked/sky` over the panorama's
  own sky (registered by the station camera; the sun's place from the same engine). Receipts C5, D4, C6 and H1
  (H1 is a proposal in `docs/claims-proposed.md`: show its number as the reply does, labelled a proposal). Queue
  what the laptop must render (panoramas, patches, flights) through `scripts/exhibit_queue.py`.
  *Done 2026-10-20 22:19 UTC, `a43efaf`, `65bbc4e`, `3576018`.* (Chunk 3 found E11 and E12 done but their boxes
  unticked, and ticked them; the tree was clean.) 15 leaves, every word of chapter 2 in order and inside the
  recording (the recordings test now covers every chapter the leaves reach). "Look at the head" wipes
  `ch1-head`'s lion head back to today at the flank; the head and the worn body below; a flight to a new station
  `sphinx-side` (decision 26) for "too small", wiped there through the First Time, the long rains and the built
  king; a turn in to the head for "smaller form" and the ghost (`object:head`, E14); back to today on Reader; a
  flight to a new station `sphinx-back` behind the rump looking east for the sky; a wipe to the First Time on
  "drift"; a flight to `sphinx` for the temples (decision 31). Until the two stations are rendered each leaf stands
  in at the flank (`until`). **The live sky** (`src/sky.ts`, `src/skyfigure.ts`, 7 tests): a leaf's `sky` names
  its year (`today` or a claim's epoch, decision 28); the bright catalogue to magnitude 4.5 is precessed to it and
  placed at the picture's own moment as `render/giza/sun.py` lights it, so the drawn sun lands on the rendered sun
  (checked in today's panorama); Leo's stars gold, Regulus named, C5's own bearings on the horizon; a year readout
  and slider, wound from 2026 to 10,500 BCE in play on "drift" (checked muted: 1323 CE at 1 s, 4,311 BCE at 3 s,
  10,500 BCE by 6 s), and dragging it pauses play. **The receipts**: C5 on the Leo leaves, D4 and C6 on the
  temples. They had never computed for a sky claim (the bundle's stars were not registered); fixed, and read
  against a local `pnpm bundle`: they match the dossier. H1 waits for E14 (decision 30). The queue asks for six
  panoramas, four new patches and, once the stations are published, three flights. Looked at at both sizes,
  stand-ins and sky. `pnpm test` (exhibit) 82 passed; typecheck clean; render tests the same 2
  missing-build-output errors.
- [x] **E13b. Leo's figure.** The beat draws Leo's figure lines, captioned "a modern figure". Import one: a
  script that fetches a modern sky culture's figure (Stellarium's `modern` sky culture gives each figure as pairs
  of Hipparcos numbers) into `data/stars/` with its source, checksum and licence in `data/sources.json`, as
  `pnpm run stars` does for HYG, and draw Leo's lines in `drawSky` from it, never typed (decision 29).
  *Done 2026-10-20 22:24 UTC, `83b993b`.* `scripts/figures.ts` (`pnpm run figures`) imports all 88 figures of
  Stellarium's modern sky culture into `data/stars/figures.json`, each star as its HYG id, refusing a download whose
  sha256 is not the one `data/sources.json` records (`stellarium-modern`, CC BY-SA 4.0, credited on the page as
  HYG is). The sky draws Leo's lines on after its stars, labelled "Leo, a modern figure". Leo stands 25 to 41
  degrees up at the picture's moment, so `ch2-leo` and `ch2-image` now look up to it (yaw 106, pitch 20, field 66)
  with the sun and the bearings still in frame. Looked at at both sizes. `pnpm test` 1175 passed.
- [x] **E14. An object in the hand** (first step: the export). A small realtime three.js view, lazy-loaded only on a leaf whose `interact`
  is `object:<id>`: the object lit simply on a dark ground, turned by dragging, with a reset. The first object is
  the ghosted head: `sphinx-built`'s king's head solid, and the master lion's head (its First Time finish, with
  night item 36's enlargement, the factor in the era record) translucent round it, placed by the head fit. Write
  `render/export_heads.py` (bpy, run by the laptop) that exports the two heads as small GLBs into
  `apps/exhibit/objects/` with a JSON of their placement and the factor; do not run Blender. Until the GLBs
  exist, the leaf shows the panorama.
  *First step done 2026-10-20 22:30 UTC, `e25101a`:* `render/export_heads.py` (bpy, for the laptop) takes the
  as-built statue (`sphinx-built`) and the First Time's (the master's `first-time` finish, head enlarged) from
  `render/giza/sphinx.py`'s own fit to the footprint, so the two heads register as in the panoramas; cuts each to a
  box round the king's head footprint (look choices, written down), centres both on the head, decimates them to
  about 60,000 faces and 1024 px textures, and writes `apps/exhibit/objects/head-king.glb`, `head-lion.glb` and
  `heads.json` (frame, crop, roles, the stand-in caveat, and the enlargement: the renders' `HEAD_SCALE` and the
  least the solve found, read from `build/models/sphinx-master-headscale.json`, decision 33). GLBs in Git LFS
  (decision 34). 4 tests for the parts without Blender. Not run here: no Blender, no models in this worktree.
- [x] **E14b. The object view.** The rest of E14: a small three.js view (add `three` to `apps/exhibit`), imported
  lazily on a leaf whose `interact` is `object:head`, reading `objects/heads.json` and its GLBs (served at
  `/objects/` in dev, copied by `scripts/site.ts` as the flights are): the king's head solid, the lion's head
  translucent round it, lit simply on a dark ground, turned by dragging, a reset, and H1's factor from
  `heads.json` beside it labelled a proposal ("on these stand-ins, the lion's head had to be enlarged N times").
  Until `heads.json` exists the leaf shows the panorama, as now. Test with the laptop's export, or with any small
  GLB in its place.
  *Done 2026-10-20 22:40 UTC, `f338758`, `ab23fd0`.* `src/objectview.ts` (three 0.186.0, the viewer's version, from
  the local store), imported only when `ch2-ghost` is reached and `objects/heads.json` is there; the lion's head is
  drawn translucent after the solid king's head; drag turns it, Reset brings it home; the caption gives H1 from
  `heads.json` (the least enlargement, labelled a proposal, and the renders' 1.17), or the look choice alone when the
  solve was not run (2 tests). Served at `/objects/` in dev, copied by `scripts/site.ts`. Checked at both sizes
  with a Meshy heron standing in for both heads (since deleted): it frames, turns, resets and hides on the next
  leaf. The two real heads have not been seen together yet: that waits for the laptop's export.
- [x] **E15. Chapter 5, "The sky as a clock": its leaves and the slider.** Cut chapter 5 into leaves likewise. The
  live figure: at night over the pyramids (the `orion` station, `built`), the stars drawn by `@seked/sky` over the
  panorama, and a year slider from today to 10,500 BCE the visitor drags (play animates it): Orion's belt sinks
  toward its lowest and its angle turns against the three pyramids' diagonal, C4's receipt live beside it,
  computed from the bundle as `apps/story`'s sky widget did (reuse it). Then the King's Chamber's southern shaft
  (`kings-chamber`, the existing `kc-shaft` overlay) drawn on toward Alnitak c. 2450 BCE. Receipts C2, C3, C4, C7.
  *Note from chunk 3:* the live sky and its year slider exist (`src/sky.ts`, `src/skyfigure.ts`, a leaf's `sky`);
  the `orion` station's night moments carry no `date`/`solar`, so its sky needs the night's sidereal time (the sky
  bake's, `render/giza/night.py`) rather than `sunAt`. The receipts now compute for sky claims.
  *Done 2026-10-20 22:48 UTC, `8c2009f`, `cf02def`, `fa80cd2`.* 14 leaves, every word of chapter 5 in order and
  inside `assets/narration/ch5.json`. They stand at `orion` (a kilometre north, looking south) at night as built:
  the belt and the pyramids under Orion in gold; Sah overhead; the 2026 study; "Drag the sky back" with the slider
  in hand; on "The belt sinks" play winds 2450 to 10,450 BCE with C4 read out live beside it (checked muted: 2,734
  BCE at 1 s, 8,533 BCE at 4 s, 10,450 BCE by 6 s, the readout 50°51′40″ against 37°51′07″ there, the dossier's);
  a wipe to the First Time under the lowest belt; a cut into the King's Chamber drawing `kc-shaft` on "shaft";
  back outside, C2's shafts dashed across the meridian at their surveyed angles with Alnitak just above the King's.
  **A night's sky** (decision 35): a moment with `night` turns the drawn sky to the hour its star crosses the
  meridian in the year shown, as the bake does, from `scripts/nights.ts` (the bake's table, moved out so the
  exhibit's build can read it). **A starless night** (decision 36): a moment may say `"stars": false`;
  `night-dark` is 2450 BCE's night without its stars or Milky Way, so the drawn sky can move without doubling.
  **What a sky picks out** (decision 37): `figure`, `bearings`, `marks`, `readout` in a leaf's `sky`; chapter 2's
  sky leaves now name Leo and C5. An inside station takes its own panorama at any moment (decision 38). Receipts C4
  and C7 on the belt leaves, C2 and C3 on the shafts. Looked at at both sizes; chapter 2's sky leaves checked again.
  The queue asks for `orion` built and First Time at `night-dark` and four patches. `pnpm test` 1183 passed;
  typecheck clean; render tests the same 2 missing-build-output errors. Left for E15b.
- [x] **E15b. Chapter 5's plan and its phone.** (a) The beat's plan: from overhead, C4's `sky-projection` laying
  Alnitak, Alnilam and Mintaka over G1 to G3, and the two offset ticks (0.185 against 0.148) for "set off the line";
  no overhead station exists, so a figure (as `ditch-plan`) drawn from the bundle's ground and the sky at C4's
  epoch, on `ch5-diagonal`. (c) On a phone the labels of `ch5-alnitak` crowd the belt (the field is so wide the
  shafts' lines are 60 px long); shorter labels or a tighter phone framing there. ((b) moved to E15c.)
  *Done 2026-10-20 22:54 UTC, `ac1a88c`, `d09d42d`.* (a) `belt-plan` (`src/figures.ts`, 2 tests) draws on
  "diagonal": the pyramids' centres from the bundle, the belt at C4's epoch laid as seen looking south, Alnitak on
  Khufu, scaled to Menkaure, unturned (decision 40); the caption's numbers are C4's two comparisons, the offsets
  among them, so no ticks were needed. Beside the sky panel on a wide screen, below it on a phone; drawn again
  when the bundle arrives. (c) On a narrow screen the shafts are named by chamber and Alnitak by its altitude.
  Both looked at at both sizes.
- [x] **E15c. The 2026 study, cited on screen.** "Allan 2026: rank 1,717 of 695,520, p = 0.0025" as a quiet cited
  caption on `ch5-allan`. The figures are in `allan-2026`'s free-text note in `data/sources.json`, which a page
  should not parse; enter them first as records with that source (`verified: false` until checked against the
  paper's table), then caption them from the records. The spoken words carry the claim meanwhile.
  *Done 2026-10-20 23:08 UTC, `3794eed`.* (Chunk 5 found the tree clean.) Two records in
  `data/measurements/orion-correlation.json`, the shape rank and the triplets tested, `allan-2026`, unchecked, under
  a new structure `giza.pyramids` (decision 42); p is their quotient, never stored (decision 43). The build cuts them
  out (`virtual:allan-rank`) and `allan-rank` draws on "ranks": every triplet as one dashed line, the best 1,717 a
  gold mark at its end, and the cited line with the journal and "Not yet checked against the paper's table". Kept on
  `ch5-named`. Looked at at both sizes; in play it draws about 10 s into the leaf. 3 tests.
- [x] **E16. Chapter 6, "Numbers in the stone": its leaves** (first step; added by chunk 4 in the plan's order,
  chapter 6 after the two showpieces, decision 41). *Done 2026-10-20 22:56 UTC, `9863899`.* 10 leaves, every word
  in order and inside `ch6.json`: at `south` as built (the walkthrough's own panorama) with `g1-proportions` drawn
  on "Measure" and kept through the numbers; a cut to `north` for true north; a cut to `panorama` (the three in a
  row, reframed tighter with the horizon near 40 per cent) for Smyth and Hancock; "Knowledge that old" wipes it to
  the First Time. Receipts as the script assigns them. No new panorama; the queue adds three patches. Looked at at
  both sizes.
- [x] **E16b. Chapter 6's figures, first two: π and true north.** The beats ask for the perimeter against a circle
  of radius the height (A1) and the compass 3′54″ west of north drawn 120 times larger (C1).
  *Done 2026-10-20 23:00 UTC, `a6791b2`, `aa0972c`.* `pi-circle` on "pi": the base square drawn round, then the
  circle of radius the original height, the caption's lengths and ratio from the bundle (6.28501 against 2π,
  tested). `north-square` on "north": the base turned by `g1.orientation` over a true square, the turn exaggerated
  by C1's own overlay factor (carried into `virtual:sky` from the claim, never typed), the far end's stray 0.261 m
  in the caption. Figures' outlines now draw themselves on. Both looked at at both sizes.
- [x] **E16c. Chapter 6's φ figure.** The apothem and the Kepler triangle on "golden ratio" (A2, with A3's "cannot
  discriminate" in the caption). *Done 2026-10-20 23:02 UTC, `50fce93`.* `phi-triangle` on
  "golden": half the base, the height and the apothem, the apothem drawn on and named with its ratio (1.6187,
  tested); the caption's numbers from the bundle, A3's point in words. Looked at at 1440 by 900.
- [x] **E16d. The 43,200 globe and the pyramid in the hand.** The profile grown into the hemisphere at 1 : 43,200 on
  "Scale" (B1, its two residuals and its two free choices), a figure from the bundle like `pi-circle`; then the
  pyramid in the hand (`object:pyramid`, the object view with a mesh generated by `@seked/geometry`, needing no
  Blender), the plan's chapter 6 object.
  *Done 2026-10-20 23:18 UTC, `8ff8a50`, `cdd399b`, `2ad447f`.* `earth-scale` on "Scale" (kept on `ch6-72`): the
  northern half of the Earth in section, the profile grown by B1's overlay factor and stood on the equator, apex at
  the pole; the caption has B1's two comparisons as the receipts evaluate them (height 6,333 km against 6,357,
  perimeter 39,801 against 40,075, both residuals) and the claim's free choices, read from it. **A bug found on the
  way:** the player took a cue word from a leaf's first `draw` entry only, so `ch6-pi` and `ch6-phi`, whose figures
  come after the pyramid's lines, never showed their figures in narrated play until paused (E16b and E16c were
  looked at paused). Line and figure are now cued apart (`leafCues`); measured in play, pi-circle at 4.0 s,
  phi-triangle at 8.0 s, earth-scale at 1.0 s, the ditch plan unchanged; a test finds every cue's word. **The
  pyramid in the hand** on `ch6-together` (decision 44): `src/pyramidobject.ts` builds the solid with
  `pyramidMesh` from the bundle's base and original height, the circle of radius the height on the ground, A2's
  triangle through the south face drawn through the stone, and a grey line north; `ObjectView.showPyramid` shows it,
  three.js still loaded only when an object leaf is reached. Looked at at both sizes, turned and reset; the next
  leaf hides it. 7 new tests; `pnpm test` 1198 passed.
- [x] **E17. Chapter 3, "Temples of the same stone": its leaves** (the plan's order after chapter 6: 3, 4, 7, 8,
  9). Cut chapter 3 of `docs/script.md` into leaves, every word in order and inside `assets/narration/ch3.json`;
  stand where the argument is seen (the Sphinx Temple and the Valley Temple, their core blocks against the ditch's
  beds) on panoramas that exist, `until` stand-ins where a station is new; receipts as the script assigns them;
  queue what the laptop must render with `scripts/exhibit_queue.py`. Figures in a later step.
  *Done 2026-10-20 23:25 UTC, `e628ea6`.* 11 leaves, every word in order and inside `ch3.json`. At `sphinx` the First
  Time wipes to today on "two temples" (D4); a cut into the granite hall as built (`valley-temple`) for the granite;
  back above the temples, close on the Sphinx Temple's bare limestone blocks for the core (decision 45), turns to the
  Sphinx in its ditch for "layer by layer" and to the lion and both temples for "the lion's stone" (D4). West and
  Schoch in the hall today (a north wall, then the south), wiped to the hall as built on "refit"; Hancock down the
  hall; Khafre's statue (the walkthrough's stand-in scan) for "Khafre's statues"; and a cut to the lion's face in the
  First Time at `sphinx-face` on "long ages before their first king" (decision 46). No new panorama or flight; three
  patches queued. Looked at at both sizes as contact sheets (`build/exhibit-shots/e17/`); played through muted, 116 s,
  no errors, no fallback voice. Left for E17b.
- [x] **E17b. Chapter 3's figures.** (a) The joint peeled open on "On camera in 1993": one Valley Temple wall in
  section, the granite pulled forward, a rounded and fissured core behind it, the granite's back shaped to it,
  captioned "the claim as West and Schoch describe it, not a survey" (a drawing of a claim, so no record is needed,
  but say so). (b) The luminescence dates the script proposes as records (`liritzis-vafiadou-2015` Table 1: VT1,
  VT9a, ST2, `verified: false` until checked), then shown in the reply's terms on `ch3-statues` or the reply panel.
  (c) moved to E17c.
  *Done 2026-10-20 23:36 UTC, `a1db894`, `182b928`.* (b) The three dates are records in
  `data/measurements/luminescence.json` (`liritzis-vafiadou-2015`, unchecked); a calendar year had no unit, so the
  schema gains quantity `date` in unit `year`, astronomical numbering as the claims' epochs (decision 47).
  `luminescence` draws them on "core" in `ch3-statues`: a bar per sample on one axis of years, named by temple, stone
  and sample from the records and `structures.json`, the paper cited short. (a) `joint-claim` draws on "camera" in
  `ch3-west`: the wall in section, schematic, the same worn profile on the core and the granite's back, captioned as
  the claim and not a survey; it holds no measurement. Both looked at at both sizes and cued in play (5 to 11 s in).
  3 tests; `pnpm test` 1200 passed.
- [ ] **E17c. The statue sockets on the hall floor.** `khafre_valley_temple.hall.socket.pitch` and
  `.socket.first.east` exist (scaled from Hölscher's Blatt XVII). Draw the row of sockets on `ch3-statues`'s floor
  as registered lines in the scene: find how `apps/walk/overlays.json` is generated, add the row there from the
  records (never typed into the overlay), and cue it on "statues".
  *Blocked 2026-10-20 23:40 UTC on a renderer change this worktree cannot check.* Overlays are written by
  `render/publish.py` (`overlays()`), outside Blender. To register with the picture the sockets must be drawn where
  the render puts its statues: `render/giza/valley_temple.py`'s `plan()` steps them from the two records along its own
  north wall line `y_ln` (from the aisle records, not `hall.stem.north`), at `floor`. `plan()` is pure but lives in a
  module that imports `bpy`, so publish cannot call it. The step: move `plan()` and `_r()` (and `temples.centroid`)
  into a bpy-free module both import, with a render test that the plan is unchanged; then `overlays()` adds
  `valley-sockets`. It also types the count: `range(7)` in `plan()`, where Hölscher's seven is only in the pitch
  record's note; a `khafre_valley_temple.hall.socket.count` record (`hoelscher-1912`, unchecked) should replace it.
  Best done by the laptop session, which can render the hall after the move and see that nothing shifted.
- [ ] **E18. Chapter 4, "The First Time": its leaves.** Cut chapter 4 likewise, on panoramas that exist, with
  `until` stand-ins where a station is new; receipts as the script assigns them; the queue run.

## Decisions

1. **The exhibit reads `../walk/` for stations, overlays and panoramas** rather than copying them, so the 4096 by
   2048 panoramas are published once; the dev server serves `apps/walk` at `/walk/` to keep the path the same.
   Reversible by pointing `WALK` in `main.ts` elsewhere.
2. **Until E2, the address picks the shot** (`?station=&era=&yaw=&pitch=&fov=&overlay=`) and the page opens on
   `sphinx-flank` today, chapter 1's station. E3 replaces it with `?leaf=`.
3. **A panorama eases in from the blank over 320 ms as it arrives** (the walk's fade-in on load, not a dissolve
   between pictures). Stewart's no-dissolves rule is about changes between leaves and eras, which E4 makes wipes.
4. **The whole prototype is lit at `equinox-dawn`** (spring equinox, the sun low on the Sphinx's axis and clear
   of the ditch's rim). It is the cold open's "dawn" and "faces the sunrise" made literal, it is already the
   moment `sphinx-face` is rendered at in the built and First Time eras, and the script's chapter 1 beat asks for
   the wall "lit by a low morning sun". One moment for every leaf keeps both flights legal. It costs five new
   panoramas (`sphinx` today, `sphinx-face` today, `sphinx-flank` today, long rains and First Time); until they
   exist each leaf shows the walkthrough's own panorama of that station and era.
5. **The cold open starts at `sphinx`, not on the rooftops of Nazlet el-Samman**, because `render/stations.json`
   has no station in the village. The words still say "from the rooftops of Nazlet el-Samman" (see For Stewart).
6. **A fourth way to arrive, `turn`**: the same panorama, the view swinging to the leaf's. The plan's schema has
   cut, flight and wipe; most leaves within a station change only where we look, and naming that keeps the
   join rules checkable. Reversible: a turn is a cut that stays in one panorama.
7. **Chapter 1 ends in the First Time, not the long rains** the beat names for "look again at the head", because
   the eras run back with the words ("seven thousand years" on the long rains, "10,000 BCE" on the First Time)
   and wiping forward again on the last sentence would undo that.
8. **A leaf's panorama for a moment the walkthrough lacks is `pano/<station>-<era>-<moment>.jpg`**, beside the
   walkthrough's; `leafPanorama` names it and E6's queue asks the laptop for it.

9. **E2b moved below E4.** The flank's lines are drawn on in time with their words, which is E4's (b); building
   them first would mean timing them twice.
10. **Play starts paused, on a Play button.** Browsers refuse speech until the visitor has touched the page, so the
    exhibit opens on its first leaf, silent, with Play the one bright control.

11. **The wipe's edge is a screen line with a slight slant, sweeping left to right**, not tied to the sun or
    the floor. It reads the same whichever way the visitor looks, and the paused comparison needs an edge a
    finger can hold. The plan's "sunlight's direction" or "the floor rising" can come later as a per-leaf
    option. Reversible in `viewer.ts`.

12. **Flights play only in narrated play.** Stepping with Next, or jumping by chapter, goes straight to the leaf:
    a visitor who is choosing does not want three seconds of film in the way. A flight's file is named by the
    two leaves it joins, so E6's queue and the player agree without a table.
13. **A cued line is drawn at once when play is paused**, and taken down to draw again with its word when play
    resumes, so a paused visitor never looks at a leaf missing the line its words promise.

14. **E2b moved below E6.** The queue is what the laptop can render tonight; the flank's lines need records the
    database lacks (the seismic lines, the weathering depths) and `render/giza/sphinx.py`'s ditch outside
    Blender, a slower job.
15. **A flight rises to clear what lies between, knowing nothing of it**: up steeply, across at a quarter of the
    distance above the higher end (8 to 60 m), down steeply onto the leaf. The laptop previews before it renders
    (below). A leaf could later carry waypoints if a path needs steering.

16. **The reply panel shows the script's spoken reply first, then the full reply**, both for the leaf's chapter,
    so every leaf of a chapter carries the same answer. Per-leaf replies would need the script to write them;
    the chapter's is what exists.

17. **The flank's ditch is a plan figure, not lines in the scene.** From `sphinx-flank` the north margin lies
    behind the statue, and an overlay knows nothing of what stands in front of it, so lines in the scene would
    draw the far wall over the body. The script's beat asked for a plan inset anyway.
18. **Chromium muted from 16:22 UTC.** The laptop session's rule (`d778b09`) came mid-chunk; this chunk's earlier
    play tests (from about 16:00 UTC) ran unmuted, so the browser's voice will have been audible on the laptop
    while they ran. Every test script launches with `--mute-audio` now.

19. **A chapter's recording is fetched whole and played from a blob URL**, not streamed. The dev server and a
    Playwright route ignore HTTP ranges, and an audio element that cannot seek plays every leaf from the top of
    its chapter. A chapter is 0.8 to 1.5 MB and plays in full anyway.

20. **E2c waits for its sources; E8 goes ahead.** Drawing the seismic lines or the slab now would mean typing
    figures the database does not hold.

21. **A leaf is framed for a wide screen, and a phone keeps its subject where the wide frame put it**, 40 per cent
    of the way down (`FRAME_PIVOT` in `projection.ts`), the extra field of a tall screen going mostly onto the
    ground under the caption. One set of numbers per leaf rather than a phone override each: a phone framing per
    leaf would double the authoring and the review. Reversible: `frameAim` returns the leaf's pitch when
    `FRAME_PIVOT` is 0.5. A flight's last frame (16:9) still matches only on a wide screen, as before.

22. **A leaf gets a patch only where it is at least 1.25 times as sharp as the panorama.** At 2560 by 1440 and
    1.3 times the leaf's field, a 70-degree leaf's patch holds 12.4 pixels a degree against the panorama's 11.4:
    nine per cent, invisible, for a render each. The panorama already matches a 1440 by 900 screen at that field;
    a retina screen would want patches twice the size (5120 by 2880), which is the laptop's time to spend or not
    (see For Stewart). `PATCH_MIN_GAIN` in `scripts/exhibit_queue.py`.
23. **A patch belongs to a panorama file, not to a station and era.** The exhibit shows one station in one era at
    more than one moment, and a patch rendered in one light laid over a panorama in another would show as a
    lighter or darker rectangle. Patches are now looked up by the address of the panorama on stage.
24. **A leaf may name a stand-in (`until`) for while its station is unpublished**, rather than the player failing
    or the leaf waiting in a branch. The stand-in is data in the leaf, the console says when it is used, and it
    stops being used the moment publish adds the station, so the prototype works tonight and needs no edit
    tomorrow. Take `until` out once the roof is rendered and liked.
25. **A roof station names no height.** It says `"roof": true` at a point on the building, and the renderer reads
    the height from `city.bin` with the rule `city.build` draws by, so the eye cannot drift from the roof if the
    city is re-imported. Its note names the record and the height's source. Decision 5 is superseded.

26. **Chapter 2 stands at two new stations, `sphinx-side` and `sphinx-back`, not `sphinx-face`.** From the face
    the body's length is foreshortened to nothing and from the flank (6 m off) the head is overhead, so neither
    shows "beside that long body it is too small"; the beat asks for a side elevation, and the sky leaves want the
    lion's own eastward view. Both are placed from the footprints and the terrain with the scene's ditch cut (their
    notes say how) and stand in at the flank until rendered. Reversible: point the leaves back at `sphinx-face`.
27. **The sky leaves stay at `equinox-dawn`, the sky drawn at the picture's own moment.** The beat holds the sky
    fifty minutes before sunrise, but a pre-dawn panorama needs a night bake, and a sky drawn for another moment
    would put the drawn sun 16 degrees from the rendered one. So the drawn sky and the picture share one instant
    (Leo already up, ahead of the sun; Regulus's rising bearing on the horizon), and the panel says that by day no
    star would be seen. See For Stewart.
28. **A sky's year is named, not typed**: `today` (the present calendar, as the renderer's moments) or a claim
    id, whose epoch it takes; the bearings are C5's own `sun-ribbon` expressions, evaluated in the sky environment.
29. **Leo is its stars until a figure is imported**: the HYG designations put a star in Leo, and its stars are
    drawn gold with Regulus and the constellation named. Lines need a figure from a source (E13b).
30. **H1's number waits for E14.** The factor is written by `sphinx_eras.py --solve-head` into a build output on
    the laptop, not into `data/`; E14's `export_heads.py` is to carry it into `apps/exhibit/objects/`, and the
    object leaf shows it, labelled a proposal. Until then the reply's own words ("enlarged by a sixth") carry it.
31. **The temples leaf stands at `sphinx`, above the Sphinx Temple**, looking down at the temple and the Sphinx
    behind it, in the First Time at equinox dawn (already rendered). At `sphinx-face` the temple's west wall
    stands 3.5 m in front of the camera and fills the view.
32. **Reader's sentence wipes back to today** (not on to the lion), so the flight to `sphinx-back` arrives in
    today's era, the 2026 sky shows "the sun rises close to due east in every age", and "drift" then wipes to the
    First Time as the years wind back.
33. **H1's factor travels in `heads.json`, read from the head solve's own output.** The solve writes a build
    file on the laptop; carrying it into the exhibit's objects beside the heads it was found on keeps the number
    and the pictures together, and nothing types 1.16. If the solve has not been run on the machine that exports,
    `least` is null and the view says only the renders' enlargement, which is a look choice.
34. **The head GLBs go in Git LFS**, as the narration does, rather than being gitignored like the flights: they
    are small, made once, and the site needs them; a flight is re-rendered whenever a leaf moves.

35. **A night's drawn sky keeps its star on the meridian whatever the year.** The bake's nights are each a star's
    transit; the slider keeps that rule, so dragging the years shows the belt sinking on the meridian, which is
    what the words say, and at the night's own epoch the drawn sky is the rendered one. The alternative (a fixed
    clock time) would swing the belt off the meridian and out of frame within a few thousand years.
36. **Chapter 5's night panoramas are rendered without stars** (`night-dark`, `"stars": false`) rather than with
    the 2450 BCE stars the walkthrough's have, because the drawn sky moves through 8,000 years and the baked one
    cannot; the script's beat asked for the sky "cut out". The dark, airglow and sun are 2450 BCE's (a sun 30
    degrees down looks the same in any age). Reversible: point the leaves back at `night-2450`.
37. **A leaf's sky names what it picks out** (`figure`, `bearings`, `marks`, `readout`) instead of the sky always
    drawing Leo and C5's bearings, so chapter 5 can pick out Orion, C2's shafts and C4 without a code path per
    chapter. C4's readout is the claim's own comparisons evaluated with the slider's year as its epoch, so at
    the claim's epoch it is the dossier's number exactly (tested). The shaft altitudes and the pyramids'
    diagonal read the monuments, so they wait for the bundle and are simply absent without it.
38. **An inside station takes its own panorama at any moment.** The King's Chamber is lit by the era's lamps and
    has no moment, and a leaf there must still name one; asking for a new render per moment would buy nothing.
    Its patches are queued with no moment, as its panorama was rendered.
39. **The sky leaves wind from 2450 BCE, not 2026.** The beat drove the epoch from 2026, but the picture is Giza
    as built with C2's night; starting the clock at the year the picture shows keeps the drawn sky and the
    rendered ground in one age until the words move them.
40. **The belt is laid over the pyramids unturned.** Turning it to fit would hide the claim's residual; C4 compares
    each diagonal's angle against the meridian, so the plan keeps both against north and lets the 13 degrees show.
    It is scaled and placed (Alnitak on Khufu, Mintaka at Menkaure's distance) only so the two can be compared.
41. **Chapter 6 is cut next, before 3 and 4**, as the plan orders it (`docs/exhibit-2026-10.md`, "Order": chapter 6
    after the two showpieces), and in two steps: the leaves now, on panoramas that exist, and the figures and the
    pyramid in the hand after (E16b).
42. **The study's records are filed under a new structure, `giza.pyramids`** (the three as a group, excavated), not
    under `plateau` (the lesser monuments) or `g1`: Allan's figures are about the triangle of all three. It adds no
    monument and promotes nothing. Reversible: move the two records' `structure`.
43. **The p-value is the rank over the count, computed, not entered.** 1,717 over 695,520 is 0.00247, the paper's
    0.0025 to two figures, so storing it would type the same number twice. If checking the paper shows its p is
    defined otherwise, enter it as its own record then.
44. **The pyramid in the hand is held on `ch6-together`**, "whether the explanations hold when the numbers come
    together", because the object is the numbers together: the circle, the triangle and north on one solid. The
    leaves before it each draw one number as a figure, and an object over a figure would crowd the screen. Reversible:
    move `object:pyramid` to another chapter 6 leaf.
45. **Chapter 3 shows the limestone core at the Sphinx Temple, from above**, not in the Valley Temple: the hall's
    renders are granite on every wall in both eras, and the Sphinx Temple's outside never got its granite (the
    reply's own point), so its bare core blocks are what "a core of local limestone" can honestly point at. The
    beat's sequence lifting the granite away needs a render the laptop has not made.
46. **Chapter 3 ends on the lion's face in the First Time**, not on a night look-around in the hall as the beat
    asked: there is no night panorama of the hall, and "long ages before their first king" leads into "The First
    Time". From `sphinx` the First Time's temple wall fills the view, so the leaf stands at `sphinx-face`, the cold
    open's own shot.
47. **A date is a record like any other: quantity `date`, unit `year`, astronomical numbering** (1 BCE is 0), the
    convention the claims' epochs and `@seked/sky` already use, so a date can one day enter an expression without a
    conversion. The page writes it back as BCE. Reversible: two enum entries in `packages/data/src/core.ts`.


## For Stewart

- **The prototype is ready to judge in the browser**, on the walkthrough's panoramas until tonight's renders land:
  `pnpm --filter @seked/exhibit dev`, then open the address it prints. Play starts it; any drag pauses; the
  tab at the right edge is the reply.
- ~~The cold open says "from the rooftops of Nazlet el-Samman" but stands at `sphinx`.~~ Settled by the laptop
  session (E12): the words stay and `ch0-dawn` stands on a roof there once its panorama is rendered.
- The cold open no longer shows Giza as built: at `sphinx` the built panorama is taken from another camera, so it
  cannot be wiped to. The textbook date is spoken over today's view. If the built Sphinx matters there, the
  built era at `sphinx` would need a render from today's camera.
- E2c needs scans of the seismic figures in Dobecki and Schoch 1992 (*Geoarchaeology* 7) and of Reader's Fig. 5,
  to read with `scripts/plate.py` into `assets/plates/`. With them the builder enters the weathering depths and
  the lines' positions (`verified: false`) and draws chapter 1's floor.
- On a phone a flight's film is cropped to fill the tall screen while the panorama widens its field, so the
  handover is not seamless there. A phone cut of each flight (or a cut instead of a flight on phones) would
  fix it; say which.
- The sky leaves of chapter 2 draw the stars over a daylit dawn (decision 27). A real pre-dawn picture at
  `sphinx-back`, the Lion low in the east before the equinox sun, would need a night bake for that moment (the
  renderer draws stars only from `pnpm run sky-bake`'s nights) and a moment change in place, which the wipe does
  not do yet. Worth it for the chapter's hero shot?
- Sharp on a retina screen: the patches (E11) make the tight leaves sharp on an ordinary screen. On a retina
  laptop every leaf wants about twice the pixels; that means patches at 5120 by 2880 for all 22 leaves, or
  panoramas at 8192 by 4096. Both are only laptop time (a patch costs about what a panorama does). Worth it?

## For the laptop

Renders the laptop session should run, with the queue or command, as items need them.

- **Chapter 5's starless nights** (E15), in `render/queues/exhibit-panos.json`: `orion` built and First Time at the
  new moment `night-dark` (the night of 2450 BCE with no star dome and no Milky Way, `render/giza/scene.py`), then
  `python render/publish.py`, which writes `pano/orion-built-night-dark.jpg` and `pano/orion-first-time-night-dark.jpg`.
  Look for a sky that is dark and starless with the airglow still on the horizon. Then the four `orion` patches in
  `exhibit-patches.json`. Until they land the leaves show the walkthrough's night panoramas, whose own stars stay at
  their year while the drawn ones move (visible as a second, unmarked Orion while the slider winds).

- **Chapter 2's two stations** (E13), `render/queues/exhibit-panos.json`: `sphinx-side` (beside the body, south of
  the ditch) today, First Time, long rains and built, and `sphinx-back` (behind the rump, looking east) today and
  First Time, all at equinox dawn. Preview first: both were placed from numbers, not pictures. `sphinx-side`
  should show the whole body side-on, rump to head, over the ditch's south rim; if the rim or the causeway hides
  the body, say so and the builder moves it. Then `python render/publish.py`, the four new patches in
  `exhibit-patches.json`, and `python scripts/exhibit_queue.py` again for the three flights
  (`ch2-nemes--ch2-small`, `ch2-reader--ch2-equinox`, `ch2-image--ch2-temples`). The rooftop's panorama is
  published, so the queue no longer lists it; the flight `ch0-dawn--ch0-sunrise` is written once `stations.json`
  carries the roof's camera.

- **Six panoramas at `equinox-dawn`** (decision 4), queued in `render/queues/exhibit-panos.json` by
  `scripts/exhibit_queue.py`: `sphinx` today and First Time, `sphinx-face` today, `sphinx-flank` today, long
  rains and First Time. `blender -b --factory-startup -P render/build.py -- --queue
  render/queues/exhibit-panos.json`, then `python render/publish.py`, which writes
  `apps/walk/pano/<station>-<era>-equinox-dawn.jpg`. They should follow tonight's claim-era re-renders (the
  long rains and the First Time without pyramids), which the walkthrough's own claim-era panoramas still lack.
  Worth a look whether the flank's floor is too dark at that hour; if so, say, and chapter 1 can move to
  `morning-east` with its flight in becoming a cut.
  *On disk by 18:34 UTC.*
- **The rooftop** (E12), first: `render/queues/exhibit-panos.json` now holds only `nazlet-roof` today at
  equinox dawn. Render, `python render/publish.py`, and look: the Sphinx's face and the two pyramids should be
  in view over the Sphinx temple, the valley temple and whatever stands in the village (the search checked the
  terrain and the city's boxes, not the monuments or the modern stands). If something blocks it, say so and
  the builder picks the next roof. Then `python scripts/exhibit_queue.py` again: it queues the flight
  `ch0-dawn--ch0-sunrise`, which can only be written once publish has recorded the roof's camera. The roof's
  patch is already in `exhibit-patches.json`; render it after the panorama.
- **Nine detail patches** (E11), `render/queues/exhibit-patches.json`, after the panoramas they register with
  (a patch older than its panorama is left out by publish): `blender -b --factory-startup -P render/build.py --
  --queue render/queues/exhibit-patches.json`, then `python render/publish.py`, which writes
  `apps/walk/pano/patch/*.jpg` and `apps/walk/exhibit-patches.json` (commit that file with `stations.json`). If a
  claim-era panorama at the flank is rendered again tonight, render its patch after it.
- **Two flights**, `render/films-exhibit.json`: `ch0-claim--ch0-schoch` (the First Time, from above the temple
  down to the paws) and `ch0-ditch--ch1-carved` (today, the paws to the flank). Preview each first (`--films
  render/films-exhibit.json --film ID --preview 0,45,89`), then render and encode into
  `apps/exhibit/flights/ID.mp4` with `render/film.py encode ... --fps 30` (the command is in
  `scripts/exhibit_queue.py`'s docstring). **`ch0-ditch--ch1-carved` climbs only about 10 m and passes close to
  the Sphinx's south shoulder: check its preview for a clip.** If it clips, say so and the builder steers it.
- **The ghosted head** (E14): `blender -b --factory-startup -P render/export_heads.py`, after
  `render/giza/sphinx_eras.py --solve-head` if `build/models/sphinx-master-headscale.json` is not there yet. Commit
  `apps/exhibit/objects/` (the GLBs go in LFS by `.gitattributes`). Look at the two GLBs together in any viewer:
  the king's head should sit inside the lion's mane, as in `ch2-ghost`'s panorama.
- (Done: the narration is on this branch since the merge `84fcedf`.) Commit `assets/narration/` (Git LFS) to this branch, or merge it in: the player reads it at `narration/`, and
  without it falls back to the browser's voice. (Tested here against the main checkout's copy.)
