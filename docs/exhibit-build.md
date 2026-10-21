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
  *Chunk 11, 2026-10-21 05:18 UTC:* still blocked, after the laptop's answer 5 (do what the repo's sources allow).
  `data/measurements/` holds no bedding, fissure, seismic-line or weathering record for the enclosure, only the two
  scaled margins `ditch-plan` already draws, and `assets/plates/` holds neither figure. Nothing more can be drawn without
  the scans.
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
- [x] **E17c. The statue sockets on the hall floor.** `khafre_valley_temple.hall.socket.pitch` and
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
  *Done 2026-10-21 01:07 UTC, `59838a0` (chunk 9), the code; a render of the hall should confirm nothing moved.*
  `plan()`, `_r()`, `statue_spots()`, `TEMPLE` and `FLOOR_LIFT` are cut verbatim into `render/giza/valley_plan.py` and
  `centroid` into `render/giza/rings.py`, both free of bpy; `valley_temple.py` and `temples.py` import them back, so
  `temples.centroid` still works. The count is the record `khafre_valley_temple.hall.socket.count` (7, `hoelscher-1912`,
  "counted on plate", unchecked), moved from `range(7)`. `publish.overlays()` writes `valley-sockets` before its
  tour-values early return: a 0.6 m mark across each long-hall statue spot at the floor, a dashed line along each row, and
  a label with the pitch record and "the south row mirrored". Written into `apps/walk/overlays.json` (that key alone, so
  the rest stays the laptop's last publish) and cued on "statues" in `ch3-statues` (decision 63). 4 render tests
  (`render/tests/test_valley_plan.py`). Looked at: turned west down the long hall (yaw 285, pitch -6) the nearest mark
  on each side meets a statue's feet; the others are drawn across the pillars hiding their statues.
- [x] **E18. Chapter 4, "The First Time": its leaves.** Cut chapter 4 likewise, on panoramas that exist, with
  `until` stand-ins where a station is new; receipts as the script assigns them; the queue run.
  *Done 2026-10-20 23:41 UTC, `8495e43`.* 11 leaves, every word in order and inside `ch4.json`. The texts (Turin,
  Manetho, sep tepi) under the night of 10,500 BCE at `orion` in the First Time, Orion live at C5's epoch and framed
  low (pitch 14), where the belt stood that year (decision 49); "as they picture it" above the Sphinx Temple in the
  First Time; "nothing stands yet" at the `panorama` stand, grass and palms; the stela beside the lion at the flank;
  Unas's Pyramid Texts under the built night at C2's epoch (decision 48), turning into chapter 5. No receipts (the
  script's are "dates only", and its records are proposals: E18b). No new panorama or flight; one patch. Looked at at
  both sizes; played through muted, 111 s, no errors. Until `orion` First Time at `night-dark` is rendered, the
  walkthrough's stand-in shows the pyramids in the First Time (see For the laptop).
- [x] **E18b. Chapter 4's figures.** The radiocarbon bands the script proposes as records (Aha from `dee-2013`;
  Djoser, Khufu, Khafre and Unas from `bronk-ramsey-2010` Table 1; 95 per cent ranges, so a start and an end each,
  quantity `date`; `verified: false`), drawn as a timeline on "first king" or in the reply. The king-list totals
  need `data/texts/kinglists.json`, a new kind of file the script says needs a sentence in `CLAUDE.md`: ask Stewart
  before creating it (For Stewart).
  *Note from chunk 5:* the bands date reigns, and every record must name a registered structure; a reign is not one.
  The smallest honest home is a site-free structure `chronology` beside `units` and `constants` (one entry in
  `SITE_FREE_STRUCTURES`, `packages/data/src/index.ts`), keys like `chronology.aha.accession.start`. Both sources'
  notes in `data/sources.json` already carry the ranges (Table 1 of each). Decide that first, then enter, then draw.
  *Done 2026-10-20 23:51 UTC, `01e7835`, the radiocarbon half; the king lists are E18c.* `chronology` is a site-free
  structure beside `units` and `constants` (decision 50). `data/measurements/chronology.json` holds eleven records,
  all unchecked: Aha's accession from `dee-2013` (95 per cent earliest and latest, and the median 3085 BCE the script
  anchors the king lists on) and Djoser, Khufu, Khafre and Unas from `bronk-ramsey-2010` Table 1, keys
  `chronology.<king>.accession.<earliest|median|latest>`, in astronomical years (decision 47). The figure `radiocarbon`
  draws each accession as a bar across its range on one axis, the first king at the top, cut from the records at build
  time (`virtual:radiocarbon`); its caption says which reigns the model places from reign lengths. Cued on "king" in
  `ch4-first-king` beside the sky (decision 51); in play it draws about 4 s in. `shortCite` now reads two-word surnames
  and "et al." ("Bronk Ramsey and others (2010)"). 4 tests. Looked at at both sizes paused and in play.
- [x] **E18c. Chapter 4's king lists.** The Turin and Manetho totals as a timeline unrolled back from Aha's median
  (`chronology.aha.accession.median`), with 13,420 alone, the two Turin figures summed (Schwaller's sum, not on the
  papyrus) and a thin line at 10,500 BCE, as the script's beat for "13,420 years and, in the next line, 23,200" asks.
  *Waiting on Stewart:* the totals want `data/texts/kinglists.json`, a new kind of file (see For Stewart).
  *Done 2026-10-21 05:18 UTC (chunk 11), `ea2609c` and `6f2b3c5`.* `data/texts/` is a new kind of file (decision 67):
  what a text says, in its own unit, cited to its line or problem, `verified: false`, validated by `loadTexts` in
  `@seked/data` (3 tests) and ruled in `CLAUDE.md`. `kinglists.json` holds the Turin list's two totals (column II, lines 8
  and 9, 13,420 + x and 23,200 + x, read at pharaoh.se) and Eusebius's Manetho (24,900 lunar years, which he makes 2,206;
  Fr. 1, Loeb p. 7, read on LacusCurtius). The figure `king-lists` (`src/texts.ts`) unrolls each back from Aha's
  radiocarbon median: 16,505 BCE for the Followers alone, 39,705 BCE for the two added (dashed, Schwaller's sum, not on
  the papyrus), 5,291 BCE for Manetho, with "+ x" tails and a thin line at C5's epoch read from its claim (decision 68).
  Cued on "13,420" in `ch4-numbers` and kept through `ch4-manetho` (decision 69). 3 tests. Looked at paused at both sizes,
  beside the sky, and in play: drawn 5.9 s into its leaf.
- [x] **E19. Chapter 7, "Before the flood": its leaves** (the plan's order: 3, 4, 7, 8, 9; added by chunk 6).
  *Done 2026-10-20 23:56 UTC, `8c76c9d`.* 10 leaves, every word in order and inside `ch7.json`. No station stands at
  Göbekli Tepe, so the chapter stays at Giza in the First Time, the same millennium (decision 52): the Younger Dryas
  over the empty plateau from the `panorama` stand (turning on from `ch6-held`), up to the sky for the comet, then a
  turn to yaw 40, the bearing of Göbekli Tepe from Giza computed from `data/sites.json` (39.7 degrees, 1,080 km), for
  Abu Hureyra and the monument paragraph. Schoch and "a plan laid out at Giza" above the Sphinx Temple in the First
  Time, with C4's `belt-plan` drawn on "plan" (receipt C4); "Some of that evidence has never been gathered" on the
  flank's floor today, where chapter 8 goes underneath. Two patches queued, no new panorama or flight. Looked at as a
  contact sheet and at both sizes; played through muted, 102 s, no errors, the belt plan drawn 4 s into its leaf.
- [ ] **E19b. Enclosure D in the hand, its fill rising** (the plan's chapter 7 object, on `ch7-monument` to
  `ch7-filled`). `render/giza/enclosure_d.py` is bpy-free and builds the pillars, wall and fill from
  `data/measurements/gobekli.json` and its `LOOK`, so a three.js object can be ported like `pyramidobject.ts` (with
  a test that its look choices match the renderer's `LOOK`).
  *Waiting on the reliefs:* Stewart ruled on 20 October (`docs/gobekli-reliefs.md`) that Enclosure D is not shown
  again without its carvings, and they stand at one first height map for Pillar 43, gitignored on the laptop. Build
  the object once the cleaned height maps are committed, carving them as normal or bump maps on the pillars they
  belong to.
- [x] **E20. Chapter 8, "Underneath": its leaves.** *Done 2026-10-21 00:00 UTC, `8d75bab`.* 10 leaves, every word in
  order and inside `ch8.json`, all today. The wells from the `menkaure` station, looking at Khafre's pyramid (yaw 8,
  the bearing from the station to `g2.centre.offset.*`), down at the ground on the wells and up for "four and a half
  times the pyramid's height"; the same view turned south for the Labyrinth, along Hawara's bearing from Giza in
  `data/sites.json` (196 degrees, 82 km), as chapter 7 faces Göbekli Tepe; the paws and "Nobody has dug for any of
  it" before the Sphinx, looking at the floor between the paws. No receipts: the script's are new labels without
  targets. Seven patches queued; no new panorama or flight. Looked at as a contact sheet and on a phone; played
  through muted, 110 s, no errors.
- [x] **E20b. Chapter 8's figures.** The script's receipts as figures, from the records: one depth scale with every
  underground object by tier (`excavated` Khafre's chambers at `g2.passage.horizontal.floor.begin.up`, the Osiris
  Shaft; `claimed` the wells and chambers at 648 m, `g2.sar-shafts`; the paw cavity), drawn on "648 metres" in
  `ch8-wells`; the depth against `g2.height.original` (four and a half heights) on "height" in `ch8-height`. The
  claimed depths need records first if `data/` lacks them (`khafre-project-2025`, `verified: false`), never typed
  into the figure. Hawara's section waits for its proposed records.
  *(a) done 2026-10-21 00:15 UTC, `3994f1e`:* the records were already in `data/measurements/g2-sar.json`
  (`khafre-project-2025`, unchecked). `khafre-depths`, cued on "falling" in `ch8-wells` and kept on `ch8-height`: to
  one scale from the claims' environment, Khafre's pyramid in stone, its rooms 3 m down, one row of the claimed wells
  dashed to 648 m and the two 80 m chambers at their foot, the pyramid's height counted down beside them to 4.52.
  Where the wells stand under the base is a look choice, said in the caption. Redrawn when the bundle lands (the
  player's list of figures that read the monuments). Looked at at both sizes, with the bundle built locally by
  `pnpm bundle` and served to the page by the screenshot script. Left: the Osiris Shaft and the paw cavity on the
  same scale (they need depth records), and Hawara's section.
  *(b) done 2026-10-21 00:21 UTC, `c2bbef0` (chunk 7):* the Osiris Shaft (`osiris_shaft.bottom.depth`, about 30 m,
  `hawass-2007`) and the paw cavity (`sphinx.paw_cavity.top.depth`, about 5 m, `dobecki-schoch-1992`) are records in
  `data/measurements/underground.json`, both unchecked, each a depth below its own ground (decision 53). `khafre-depths`
  draws them beside the pyramid's foot, the shaft in stone and the cavity dashed, and the caption names them; at this
  scale they are a few pixels, which is the point. Labels crossing the heights bar are outlined. The story's chapter 8
  scale (`apps/story/src/depths.ts`) now draws both instead of naming them undrawn. Looked at at both sizes, the
  exhibit's figure and the story's scale (where the paw label was shortened to clear Hawara's column on a phone).
  Left: Hawara's section. Its records exist (`data/measurements/hawara.json`, read by the story's scale), so it is
  no longer waiting; it is E20c.
- [x] **E20c. Hawara's section on `ch8-hawara`.** Petrie's chips, the resistivity closures and the Mataha walls on
  one depth scale from `data/measurements/hawara.json` (the keys `apps/story/src/depths.ts` reads), each by its tier,
  as an exhibit figure cued in `ch8-hawara`.
  *Done 2026-10-21 00:23 UTC, `79d93cf` (chunk 7):* `hawara-depths` draws the three ranges side by side on one
  axis to 14 m, each bar's tier read from its structure (stone, blue, dashed), labelled with its range and tier. Cued
  on "chips" in `ch8-chips`, not `ch8-hawara` (decision 54). 2 tests. Looked at at both sizes with the bundle served.
- [x] **E21. Chapter 9, "What would settle it": its leaves.** *Done 2026-10-21 00:04 UTC, `3ee1dd2`.* 10 leaves, every
  word in order and inside `ch9.json`, all today; every chapter of the script is now in leaves (113). Opens on the
  Sphinx at dawn with chapter 0's framing; the flank's floor for the seismic lines (yaw 285, pitch -30, as
  `ch1-floor`), east along it for "in front of the lion" and the cores, the ditch wall for the 2008 boreholes; the
  paws for "Underneath"; the north face for the muon corridor; and it ends on chapter 0's last frame (`ch0-ditch`'s
  view at `sphinx-face`), as the beat asks, held 3 s. No receipts (the chapter's are tiers and the voids' records, not
  claims); no new panorama, patch or flight. Looked at as a contact sheet and on a phone; played through muted, 100 s,
  no errors.
- [ ] **E21b. Chapter 9's figures.** (a) The model answer on "error bars" in `ch9-answer`: the north-face corridor's
  size with its sigmas from `data/measurements/g1-voids.json` (verified). (b) The two undrilled cores and the 2008
  boreholes in plan and section, once W1's depths and the boreholes' scaled positions are records (E2c's sources).
  (c) Chapter 8's depth scale returning with each claim's test beside it (after E20b).
  *(a) done 2026-10-21 00:09 UTC, `72581c0`:* `corridor` on "error" in `ch9-answer`: the corridor in a north-south
  section to scale from `g1-voids.json` (all verified, Procureur and others 2023), 9.06 by 2.18 m with a band of plus
  and minus each sigma, 0.84 m behind the Chevron, its floor 20 m up on a broken axis, the width across in the caption
  with "The Sphinx's claimed cavity has no comparable figures at all". The paper's length is the record `.width` (the
  project's keys take length east to west); a test pins that. Looked at at both sizes; in play it draws about 10 s in.
  *(c) done 2026-10-21 00:33 UTC, `0b5b0d0` (chunk 8), with E24:* `looked-tests` on "underneath" in `ch9-underneath`,
  E24's figure with chapter 9's test under each claim (open the cavity, release the radar data, dig below the chips).
  The beat's Hall of Records (ghosted) and rump passage (solid) are left out: neither has a depth record. Left: (b).

- [x] **E22. Chapter 6, "how they did the math"** (the plan's "Added 20 October" section, agreed with Stewart): Rhind
  problem 56 in the scribe's steps beside our pyramid, the 5½-palm seked becoming 2π and φ with A3's receipt; north as
  a method (Spence's two stars, the equinox shadow, the drift that dates the pyramids); the engine's sorting made
  visible (no free choices, units chosen, fails); the gap said in words (no mathematical papyrus from the pyramid age).
  *Four steps done 2026-10-21 00:45 UTC (chunk 8), without new spoken words (decision 57).* (1) `seked-rule` on
  "ordinary" in `ch6-hancock`, `9145910`: a cubit's seven palms up and the seked's palms across, the seked read back from
  A3's own target, stepped in whole cubits to the survey's height (40 steps: 440 by 280, beside the survey's 439.9 by
  280.0), perimeter over height becoming 44/7 against 2π and the apothem over half the base against φ; caption A3's
  three comparisons live with its count of free choices, and (`55c8790`) that the papyri are centuries younger than the
  pyramid, no date typed. (2) `north-drift` on "compass" in `ch6-north`, `35ba0b5`, `591f9ac`: Khufu's, Khafre's and
  Menkaure's turns from north in building order from their verified orientation records, at C1's exaggeration, with
  Spence's reading in the caption. The player now shows a leaf's figures in turn, each at its word, the last when paused
  (decision 58); checked in play, the square at 4.3 s and the drift at 9.4 s. (3) `claim-sort` on "shape" in
  `ch6-smyth`, `1d26a4e`: every claim the chapter names sorted live into holds with nothing chosen, holds once something
  is chosen (with the count), and does not hold; D1 to D3 added to `ch6-together`'s receipts, as the script's drawer
  lists them. Holds raised to 5 s on both leaves so the late figures can be read. All looked at at both sizes. Left
  for E22b.
- [x] **E22b. The rest of "how they did the math".** (a) Rhind problem 56 in the scribe's steps: its figures (a base of
  360 cubits and a height of 250, as the research reads it) are text, not measurements, the same question as chapter 4's
  king lists (For Stewart): enter them once that is settled, then draw the steps beside `seked-rule`. (b) Meidum, the
  Bent and the Red Pyramid's orientations (`spence-2000` Table 1, Dorner, Petrie's *Medum*; `verified: false`), which
  need structures and a site entry for Meidum and Dahshur, so the drift starts before Khufu. (c) Spence's two stars
  (Mizar and Kochab) lining up over the pole, drawn with `@seked/sky` at the three pyramids' dates. (d) A spoken
  sentence for the gap needs a script change and a re-recording of chapter 6 (For Stewart).
  *(c) done 2026-10-21 01:00 UTC, `aa08a1e` (chunk 9):* `pole-stars` on "compass" in `ch6-north` (`src/polestars.ts`,
  4 tests). The plumb line through Mizar and Kochab, from `data/stars/named.json` precessed by `@seked/sky` at Giza's
  latitude, is true north only in 2465 BCE (Spence's 2467); it strays about a third of an arc minute a year, east or
  west by which star is above. Each pyramid's orientation record is read off it as a year in both configurations (Khufu
  2478 or 2453 BCE, Spence's 2478; Khafre 2483 or 2448; Menkaure 2420 or 2510), and Khufu's and Khafre's radiocarbon
  accessions (`virtual:radiocarbon`) sit below on the same years, 80 to 180 years earlier, which the caption says
  plainly (decision 62). The leaf's figures are spread over its sentence and its hold raised to 8 s (decision 61).
  Looked at paused at both sizes and in play: the square at 1.8 s, the drift at 4.3 s, the stars at 9.4 s, held to
  18.1 s. Still waiting: (a) and (d) on Stewart, (b) on its records.
  *(b) done 2026-10-21 01:18 UTC, `5a12ddc` (chunk 10):* Dash 2017's Table 3 (p. 7, the journal's free PDF, read on the
  page image) gives every side of the Fourth Dynasty's six casings with its source. Meidum (−24.4′, Petrie 1892), the Bent
  (−10.2′, Dorner 1986) and the Red Pyramid (−8.7′, its east side only, Dorner 1998) are records in
  `data/measurements/sneferu.json`, each citing the survey Dash takes it from, with Dash's page in the note, all unchecked
  (decision 65). `meidum` and `dahshur` are sites, three structures `excavated`. `north-drift` draws six needles in
  building order at 70 times rather than C1's 120 (decision 64), its labels on two rows; `pole-stars` keeps Giza's three
  (decision 66). 1 new test, the two site-listing tests extended. Looked at in play at both sizes: the drift shows from
  4.4 to 9.5 s. Spence's own Table 1, which the research quotes for the same pyramids, was not read.
  *(d) done 2026-10-21 05:18 UTC (chunk 11), `3265a38`:* the laptop's sentence follows "Each number alone has an ordinary
  explanation" in `docs/script.md` (chapter 6 now 245 words, the running time 2,096 words) as its own leaf, `ch6-papyri`,
  the seked rule still drawn. Until chapter 6 is re-recorded (For the laptop) that leaf speaks in the browser's voice; the
  recording test lists it in `AWAITING_RECORDING`, and the entry fails once the new recording holds it (decision 70).
  *(a) done the same chunk, `ea2609c` and `6f2b3c5`:* `data/texts/rhind.json` holds problem 56's base and height (360 and
  250 cubits), from Greenberg's summary of Chace's edition, read through a page summary and unchecked; a new source,
  `greenberg-rhind`. The papyrus's answer is not stored: `rhind-56` works it from those two in the scribe's steps (half
  the base, over the height, 1/2 + 1/5 + 1/50 of a cubit, times 7 palms: 5 + 1/25), the fractions by the greedy unit
  fraction rule, which gives the papyrus's own (a test pins both), beside Khufu's 5 + 1/2 read from A3's target, the
  two slopes drawn on one cubit of rise. Cued on "papyri" in `ch6-papyri`, after the seked rule. 2 tests. Looked at at
  both sizes; in play it draws 2.3 s into the leaf. E22b is complete.
- [x] **E23. Every claim marked by how far its evidence has got** (the plan's tone rule): plain words from its tier on
  every claim shown, and for a reported but unproven one, one line on what it would change if it held.
  *Done 2026-10-21 00:48 UTC (chunk 8), the plain words; the "what it would change" lines are E23b.* (1) `f719eb7`: every
  claim in the receipt panel says what it stands on and how far that has got ("It stands on the Great Pyramid of Khufu:
  dug and dated."). `claimEvidence` (`receipts.ts`) follows the claim's formulas back through derived quantities to
  their records and their structures and reports the weakest tier among them (decision 59); `TIER_WORDS` holds the four
  phrases. (2) `222e7ee`: Hawara's section and the `looked` figure give each tier they draw in the same words in their
  captions. 2 tests. Looked at open at both sizes. Every claim in `data/claims/` reads excavated monuments today, so
  every receipt says "dug and dated"; the tiers below that show in the figures.
- [x] **E23b. What a reported claim would change if it held.** For each `claimed` structure the exhibit shows (the
  Khafre scans, `g2.sar-shafts`, the model case; the paw cavity; the Mataha walls), one line on what it would change,
  as the plan's Göbekli Tepe example. The line is prose about a structure, so its home is an optional field in
  `data/structures.json` (proposed `if_it_held`, with the zod schema in `packages/data` and the parity reader in
  `blender/seked_data.py` taught it), shown in the panel and the depth figures' captions. Draft the lines from the
  script's own replies and the plan's words on the Khafre scans ("preliminary, contested, the paper behind the method
  retracted, and if even part of it held, a rewrite of the plateau's history").
  *Done 2026-10-21 00:51 UTC, `ddbcf8f` (chunk 8).* `if_it_held` is an optional field of a structure (zod schema in
  `packages/data/src/core.ts`; the Python reader passes unknown fields through, so it needed nothing), set for
  `g2.sar-shafts`, `sphinx.paw-cavity` and `hawara.mataha-walls` (decision 60). Khafre's depth figure ends its caption
  with the scans' line, Hawara's with the walls'. A test holds that only `claimed` structures carry one. The paw
  cavity's line is in the data but on no caption yet: `looked`'s caption is already long (a later place: the reply
  panel of chapter 9, or E2c's floor figure). Looked at at both sizes with the bundle rebuilt.
  *Chunk 9, 01:08 UTC, `eaf2ff5`:* the paw cavity's line now ends the `looked-tests` caption in `ch9-underneath`, beside
  its test ("open the cavity"), as "The paw cavity: if it held ...". Looked at on a phone; it fits.
- [x] **E24. "How deep has anyone looked?"** On chapter 8's depth figures, beside each claimed depth, a bar for how
  deep anyone has drilled, dug or surveyed there, and who, each from its source (records, `verified: false`).
  *Done 2026-10-21 00:33 UTC, `0b5b0d0` (chunk 8).* One figure, `looked`, rather than a bar added to each of chapter 8's
  figures (decision 55): the paw cavity (5 m) beside the 2008 boreholes (20 m, beside it, logs unpublished), the wells
  under Khafre (648 m) beside Khafre's own rooms (3 m, none drilled), the walls at Hawara (8 to 12 m) beside Petrie's dig
  through the chips (7.3 m), on one logarithmic axis (decision 56), each claim by its structure's tier. The boreholes'
  depth is the one new record, `sphinx.boreholes_2008.depth` (`ysi-2009-sphinx`, unchecked); the rest were records.
  The 1978 drill holes (`dolphin-1978`) have no depth on record, which the caption says. Cued on "dug" in `ch8-dug`.
  2 tests; `pnpm test` 1213 passed. Looked at at both sizes with the bundle served. A radar's stated reach is not drawn:
  no record gives one.
- [ ] **E25. The Vulture Stone over the sky** (chapter 7): Pillar 43's relief (the line drawing's height map,
  `build/gobekli/p43-height-a.png`, or an outline from the excavators' drawing, labelled a reconstruction) laid over
  the sky `@seked/sky` computes at Göbekli Tepe, with Sweatman and Tsikritsis's date as the claim's free choice and
  the reply. See `docs/gobekli-reliefs.md`.
  *Waiting on Stewart (chunk 9, 01:02 UTC):* the relief exists only as `build/gobekli/p43-height-a.png` on the laptop,
  made from the excavators' drawing via Collins's page, which `docs/gobekli-reliefs.md` says is looked at, not
  republished; laying it on a public page is his call. And the date and the figures' pairing (vulture as Cygnus,
  scorpion as Scorpius) are the claim's inputs, so they want a claim file citing Sweatman and Tsikritsis 2017, read
  from the paper rather than typed from memory. See For Stewart.
  *Two steps done 2026-10-21 05:32 UTC (chunk 11), after the laptop's answer 4.* (1) `f42ce37`: the paper read in its
  Zenodo PDF (CC BY 4.0). Its vulture is the teapot of **Sagittarius**, not Cygnus (that is Collins's; the plan and the
  reliefs note are corrected, `ca8ec2d`), and its date is the summer solstice at sunset, the sun just above the spout, in
  10,950 BC ± 250 (pp. 237 to 238). Claim C8 tests the observer-free part: the spout's (Alnasl, γ Sgr, now a named star
  from HYG) ecliptic longitude of date against the solstice sun's 90°, the paper's 250 years as the band (3.5°). It
  misses by 4.2°: by Vondrák 2011 the spout reaches the solstice point about three centuries earlier. Checked two ways
  (decision 71). (2) `6632254`: `vulture-sky` (`src/vulturesky.ts`, 3 tests) on "animals" in `ch7-monument` with C8's
  receipt: the ecliptic of that year flat around the solstice sun, the five constellations C8's overlay pairs with the
  animals, the spout, its miss computed apart from the engine and held equal to it by a test (decision 72). C8's
  overlay is `panel` (decision 73). Looked at paused at both sizes and in play (drawn at 13.7 s). Left: the relief laid
  over the chart, from the laptop's own reconstruction once its height maps are committed, labelled "a reconstruction
  after the excavators' drawing (DAI)"; and whether the leaf should speak of it (For Stewart).
- [x] **E26. The world's pyramids on a globe and a timeline** *(done by E26b and E26c, chunk 12; laid straight, not on a globe: decision 77)* (chapter 9's closing leaf, the plan's "Added 20
  October"): imported sites with date ranges, the best-fit great circle as the claim, the same fit for random sites in
  the same latitude band as the reply.
  *First step done 2026-10-21 01:02 UTC, `d8c1c2d` (chunk 9): the arithmetic.* `apps/exhibit/src/greatcircle.ts`: the
  least-squares great circle through a set of sites (its pole the smallest eigenvector of the sites' summed outer
  products, by Jacobi rotations), each site's signed distance off it in degrees, and the reply, the same fit for as many
  random sites spread by area over the same band of latitude, from a seeded generator, with the share that come as
  close. 7 tests, one of which shows any three sites fitting well by chance. Kilometres need the Earth's radius from a
  record, so the figure will convert. Left as E26b.
- [x] **E26b. The sites, then the globe and the timeline.** *Done 2026-10-21 05:46 UTC (chunk 12), the sites, the fit, the reply and a figure; the dates, the sites' own coordinates and the timeline are E26c.* After the laptop's answer 3 (the proponents' own list): `6e1d5c2` enters Jim Alison's table (the circle Hancock draws on) as `data/places/great-circle.json`, his 17 sites in his degrees and minutes with his axis and tolerance sentences, a new proponent source `alison-great-circle`, `verified: false`, no circle stored; `apps/exhibit/src/worldsites.ts` fits it (within 0.34° of his axis; his six "0 miles" sites within a tenth of a degree of their own circle; but Giza sits 0.26°, about 29 km, off the axis he prints, so his axis and his miles disagree, which a test pins). `ed2ae45` the reply (decision 75): `pnpm run worldheritage` (`scripts/worldheritage.ts`) imports the World Heritage List's 944 cultural and mixed properties from Wikidata (CC0, sha256 in `wikidata-world-heritage`) into `data/places/world-heritage.json`; his circle passes within a quarter degree of 10 of them, 2,000 random circles about 4 on average, 12 per cent as many or more, the best 32. `2c6609c` the figure `great-circle` on "story" in `ch9-story`: the circle laid straight, one row a site, km from `earth.radius.mean`, and the random circles' counts as bars with his marked; hold 3 s. 9 tests; `pnpm test` 1255 passed. Looked at paused at both sizes with the bundle served, and in play (up from 7.5 s to 15.9 s). The earlier note follows. Waiting on the dataset (For Stewart). Wikidata, tried in
  chunk 9 (`build/pyramids/query.rq`, everything that is an instance of a subclass of pyramid, Q12516, with
  coordinates): 178 items, only 35 with an inception date, the Egyptian ones nearly all undated, and modern ones mixed in
  (the Louvre's, a garden pyramid of 1748, a temple of 2021). Once a source is chosen: an importer in the manner of
  `scripts/figures.ts` (download in `build/`, its sha256 in the source entry), `data/places/pyramids.json` with each
  site's date range as its source gives it, then a figure: the sites on a turnable or flat globe with the fitted circle,
  each site's distance in km, the chance share, and a timeline of the date ranges.
- [x] **E26c. The great circle's dates, the sites' own coordinates and the timeline.** *Done 2026-10-21 05:52 UTC (chunk 12), `52650d0`.* Each site's `own` block (point, years, what the years are of, the article's words, source, `verified: false`) from its encyclopedia article: 16 Wikipedia sources and EverybodyWiki for Paratoari (Wikipedia has no article), read through page summaries. Aneityum has no named monument and Paratoari is natural rock by the 1996 survey, so both are undated; Tassili (about 10,000 BCE on) and Petra are open-ended. Alison's Pyay is placed at Sri Ksetra (decision 79). The timeline is the strip's right-hand column rather than a third chart (decision 80): the works run from about 10,000 BCE to 1500 CE. On the sites' own points the best circle stays within a degree of his, the sites 33 km off it on average against 24 on his figures; the caption computes both. 4 tests; `pnpm test` 1259 passed. Looked at paused at both sizes and in play. The globe is not built (decision 77). The moai's dates come from Wikipedia's Moai article, named in the Easter Island source's note rather than a source of its own: worth its own entry when someone checks it. The laptop's answer 3 asks for
  each site's date range and coordinates from that site's own source (`verified: false`; Wikidata only to fill
  coordinates). Add them beside Alison's figures in `data/places/great-circle.json` (a `own` block per site: point,
  date range in years, source), run the fit on both and say in the caption how far the two sets differ, then a timeline
  of the date ranges under the strip (Giza's pyramids, Nazca's lines, Easter Island's moai, Angkor's temples and the rest
  span thousands of years, which is the plainest reply). Paratoari (a natural formation by most accounts) and Aneityum
  need their sources read with care. A globe needs a world coastline, which the repo lacks (`data/places/basemap.json`
  is a box round Egypt): a Natural Earth 110 m import through `scripts/basemap.ts` if a globe is still wanted.

- [x] **E27. A recording of the exhibit, with its sound** (for a critic who watches it as a visitor would; Stewart fears
  it is too slow). `scripts/capture_exhibit.py [--from LEAF] [--to LEAF] --out build/critic/NAME.mp4`: Playwright at
  1280 by 720 with `record_video_dir`, muted, plays the exhibit in narrated play from leaf to leaf without touching it,
  and logs each leaf's start time and each recording span it played; then lays the recorded narration
  (`assets/narration/chN.mp3` spans and the replies if played) under the video at those times with the ffmpeg that
  `imageio_ffmpeg.get_ffmpeg_exe()` gives, into one mp4. Test it on chapter 0 only (it records in real time); the
  laptop runs the whole.
  *Done 2026-10-21 06:00 UTC (chunk 13), `eef3ed5`.* `scripts/capture_exhibit.py` starts the dev server, presses Play on the first leaf in
  muted Chromium at 1280 by 720 and records until play leaves the last leaf (by default the first leaf's chapter). The
  player now keeps `player.log`: each leaf put on the stage, each span of a recording from the moment it sounded to where
  it stopped, and each leaf the browser's voice said instead, in wall-clock milliseconds, so the script lines them up
  with the video (decision 81). ffmpeg trims each span out of its `chN.mp3`, delays it to its time and mixes it over
  silence the length of the picture; a JSON timeline is written beside the mp4, listing any leaf that was silent because
  the browser's voice said it. 8 tests. Run on chapter 0: 66.7 s, nine spans, the sound present (peak 3 dB under the
  source, from the mono recording spread to stereo), three frames looked at; and on two leaves, cut where the third
  went on. The video is the page's own recording, so a flight film plays in it as the visitor sees it. For the laptop:
  the whole run (below).
- [x] **E28. The laptop's review notes** (`docs/laptop-2026-10-20.md`, decision 18): (a) the head in the hand reads
  rough: hide or cap the cut faces, light it as a museum object, let it fill its card, start at a three-quarter view
  where the lion's head visibly encloses the king's; (b) chapter 8's "wells" leaf shows the plateau, not the wells;
  (c) chapter 6's labels on the pyramid are small and crowd each other at 1280 by 720.
  *Done 2026-10-21 06:12 UTC (chunk 13).* (a) `b585e09`: the view cuts both heads again a metre inside the export's crop
  box (2.5 m under the chin, where the lappets' edge is ragged) and fills the king's cut as flat dark stone, lights them as
  a case would (warm key high front left, cool fill, a rim behind, little ambient, filmic tone mapping), frames on what the
  cut leaves of both, and starts at a front three-quarter view from the north-east with the lion's head seen round the
  king's (decision 82). The lion is drawn both sides, since the crop opens its face. 3 tests. (b) `b6d8952`: the claimed
  wells are drawn in the scene, not only in the figure: `src/wells.ts` builds an overlay from the records the depth
  figure reads (eight dashed wells from Khafre's base down 648 m, plunging out of the picture, the base outlined faintly,
  the label saying it is a claim placed by choice), cued on "wells" before the figure on "falling" (decision 83). 3 tests.
  (c) `cd8f979`: the scene's labels grow with the stage (1.28 times at 1280 wide, at most 1.4, unchanged on a phone),
  move off a label already drawn, and step sideways off a figure's panel (decision 84). 5 tests. All looked at at 1280
  by 720 and 390 by 844, (b) also in play; the heads with the laptop's export (`apps/exhibit/objects/`, not committed,
  served to the page from the main checkout). `pnpm test` 1270 passed.

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
48. **Unas's sky is Giza's at C2's epoch, 2450 BCE**, not Saqqara's at 2400 as the beat asks: a sky's year is named
    by a claim (decision 28) and C2's is the nearest, and Saqqara is not in `data/sites.json`. Fifteen kilometres and
    fifty years move Orion by a fraction of a degree. The panel names the year it draws.
49. **The First Time's night shows Orion low, as it was**, not "high in the south" as the beat says: at C5's epoch the
    belt crosses the meridian about 9 degrees up, its lowest, which is chapter 5's point. The leaves look lower to
    keep it in frame.
50. **Reigns are dated under a site-free structure, `chronology`**, as chunk 5's note proposed: every record names a
    structure, and a reign is not a monument, so it joins `units` and `constants` (one entry in
    `SITE_FREE_STRUCTURES`) rather than a new entry in `data/structures.json`, which would give a king an evidence
    tier. Reversible: one set entry and one file.
51. **The radiocarbon bands are drawn on the claim's leaf, "Egypt did not think it began with its first king"**, not
    only in the reply panel: the sentence names the first king, and the bar is when he reigned, which the king lists
    (E18c) will count back from. The panel stays text, as every other chapter's. Reversible: move `radiocarbon@king`.
52. **Chapter 7 stands at Giza, facing Göbekli Tepe**, not at Göbekli Tepe: no station or panorama exists there, the
    Enclosure D renders are flat stills without the reliefs Stewart asked for, and the First Time at Giza is the same
    millennium the chapter is about. The leaves for the monument look along its bearing from Giza, so the picture
    points where the words are. Reversible: give the monument leaves an `until` once a Göbekli station exists.

53. **A depth below a thing's own ground is a `.depth` key, positive downwards**, as the story's scale and Hawara's
   records already read them, not a `.up` key on the pyramid's base plane: the Osiris Shaft is measured from the
   causeway and the paw cavity from the enclosure floor, and no record places either ground against G2's base. The
   two values came from the structures' register notes and are unchecked; the figure says each is from its own
   ground. Reversible by re-keying once a source gives the grounds' levels.
54. **Hawara's depths are drawn on `ch8-chips`, on "chips"**, not on `ch8-hawara` as E20c first said: `ch8-hawara`
   only names the Labyrinth and Herodotus, and it is `ch8-chips` that says "eight to twelve metres down". Reversible
   by moving the cue in `apps/exhibit/leaves.json`.
55. **"How deep has anyone looked?" is one figure for the three claims, not a bar on each depth figure.** Chapter 8's
   two figures are drawn to linear scales (648 m and 14 m), where a 3 m dig or a 20 m borehole would be lost or crowd
   the wells; one figure puts every claim beside its check, which is Stewart's point, and chapter 9 reuses it with the
   tests. Reversible: the rows are a table in `figures.ts` (`LOOKED`).
56. **Its depth axis is logarithmic, 1 to 1,000 m, and the caption says so** in plain words ("grows tenfold at each
   mark"): the wells are a hundred times deeper than the rest, and on a linear axis the paw cavity, the boreholes and
   Hawara would share a few pixels. The deepest look beside each claim is the nearest the records give: the boreholes
   stand beside the cavity, not in it, and the caption says that too.
57. **"How they did the math" goes into chapter 6's existing leaves as figures, with no new spoken words.** A new leaf
   needs words in `docs/script.md`, and chapter 6 is already recorded; new words mean a re-recording and Stewart's say
   on the text. The figures sit on the sentences they answer: the seked on "an ordinary explanation", the drift on "no
   compass", the sorting on "written into one shape" (the beat's own small multiples). Reversible by moving the cues.
58. **A leaf may show more than one figure, each replacing the last at its word**, and a paused leaf shows the last,
   where the leaf ends in play. One figure a leaf would have put the drift on a sentence about something else.
   Reversible in `player.ts` (`setFigure`).
59. **A claim's evidence is the weakest tier among the structures its inputs belong to.** A claim reading a dug
   pyramid and a claimed shaft is only as far along as the shaft. Sky inputs (stars) and site-free records (units,
   constants) carry no tier and are left out. Reversible in `claimEvidence`.
60. **What a reported structure would change is a field of the structure, `if_it_held`, written by the builder** from
   the plan's and the script's own words, not a claim file and not a caption typed in code: it is about the structure,
   the same in every place that shows it, and a test keeps it off anything dug. Stewart may want to read the three lines
   (`data/structures.json`).
61. **`ch6-north` shows three figures, each on its own part of the sentence**: the base square on "sides", the drift on
   "north", Spence's stars on "compass", with the hold raised from 5 to 8 s. With the stars added on "compass", the drift
   on "quarter" showed for 1.5 s; spread out, each shows 2.5 to 9 s. Reversible in `apps/exhibit/leaves.json`.
62. **Spence's two configurations are both drawn, and the radiocarbon beside them.** Which star hung above is the
   reading's own free choice (it flips the sign of the stray), so each pyramid gets a year from each, and the figure does
   not pick one per pyramid as the paper does. The reign dates come from the same records as chapter 4's `radiocarbon`,
   so the gap between the stars' dates and the radiocarbon dates is computed, never typed. Reversible in
   `src/polestars.ts`.

63. **The sockets are cued on `ch3-statues` but its view is kept**, the close-up of one transverse-hall statue: the
   socketed rows run west of the camera, behind the visitor, so in play the overlay is out of frame and a visitor who
   turns round finds it. Turning the leaf west would show the rows, but drawn across the pillars that hide most of the
   statues (overlays have no depth), and would throw away the leaf's queued patch. A clean view wants a camera in the
   long hall's middle aisle (For the laptop). Reversible: the leaf's `view` in `apps/exhibit/leaves.json`.
64. **The drift figure caps its own exaggeration**: C1's 120 while every needle stays within 30 degrees, otherwise the
   largest multiple of ten that does (70 with Meidum), and the caption gives both numbers. At 120 Meidum's needle leans
   49 degrees and crosses its neighbours; the claim's overlay is about Khufu alone and keeps its 120. Reversible in
   `figures.ts` (`MAX_LEAN`, `driftExaggeration`).
65. **Sneferu's orientations cite the survey each comes from, transcribed through Dash 2017**, the one source read: the
   record's `source` is Petrie 1892 or Dorner 1986 or 1998 (Dash's notes 23 to 25), the note names Dash's table and page,
   and all three stay `verified: false` until someone reads the surveys themselves. Dash, not Spence 2000, because his
   paper is free to read and prints every side; Spence's Table 1 (the research's −18.1′/−20.6′ for Meidum are two of
   Dash's sides) was not consulted. The two sites' origins are Wikidata's coordinates (CC0, cited for position only) and
   GLO-30's median on a ring 250 m out, since the surface model at the point reads the pyramid's mound. Reversible:
   `data/measurements/sneferu.json` and the two entries in `data/sites.json`.
66. **`pole-stars` stays with Giza's three.** Read off Spence's line, Meidum's 24′ would push the plot's window out by
   decades and crowd its six labels, and the caption's dating speaks of Khufu. The drift shows the earlier three; the
   needles carry a `site` so the stars' figure can filter. Reversible in `main.ts` (`poleStarsFigure`).
67. **`data/texts/` holds figures, not records**: its own schema (`TextFigureSchema`: key, text, locus, value, unit among
   year, lunar year, cubit and palm, `plus_x`, reading, source, verified) rather than measurements with a new unit, so a
   text's years can never reach a claim's environment or a preset. One file per subject (king lists, Rhind). Reversible:
   the files and `loadTexts`.
68. **The king lists end at Aha's radiocarbon median and the line is C5's epoch**, both read at build time, so the
   figure types neither 3085 nor 10,500. Manetho is drawn in Eusebius's own conversion (2,206 years), his 24,900 lunar
   years named in the caption: drawing 24,900 as years would be a reading neither the text nor its translator makes.
69. **`king-lists` waits for "13,420" in `ch4-numbers`**, not `ch4-turin`, so the timeline arrives with the numbers it
   draws; `ch4-first-king` keeps the radiocarbon bars. Reversible in `leaves.json`.
70. **A leaf added after its chapter was recorded is named, not excused**: the recording test keeps every other leaf
   to the full check and requires the named leaf to be missing from the recording, so the exception expires by itself.
71. **C8 compares longitudes, not the paper's picture.** The paper read its date by eye in Stellarium from Şanlıurfa at
   sunset; the one part of that which needs no observer and no horizon is where the spout stood in longitude of date
   against the solstice sun, so that is the comparison, with the paper's ±250 years as the band and "slightly above"
   left untested. A wider band, or the sun's position against the vulture's wing rather than the spout, would be other
   choices; each is a line in `data/claims/C8.yaml`.
72. **The chart is flat in ecliptic coordinates of date**, not a sky over a panorama: no station stands at Göbekli Tepe
   and the live sky is Giza's. Longitude rises to the left, as a southern sky is seen. Reversible: `vulture-sky` is one
   figure on one leaf.
73. **C8's overlay is `panel`, carrying the pairings as params.** The pairings are the claim's inputs, so they live in
   its file; the viewer's scene is Giza's and holds nothing of Göbekli Tepe, which `panel` exists to say. The web test's
   list of panel claims names C8 with that reason.
74. **The great circle's claim runs on Alison's own coordinates**, the claim as he draws it, like a text's figures. The
   laptop's answer asked for each site's coordinates from its own source; those go in beside his (E26c) and the fit
   runs on both, so the claim is never strengthened or weakened by our choice of points.
75. **The reply draws on a pool, not random points in a band.** Seventeen random points never line up as well as
   seventeen chosen ones (0 of 2,000 did), so that reply would flatter the claim and say nothing about choosing. The
   fair question is how unusual his circle is among comparable places: the World Heritage List's cultural properties,
   counted within his own quarter of a degree, against circles with random poles. `chance` in `greatcircle.ts` stays,
   undrawn. Another pool (a list of ancient sites only) is one import away.
76. **Whole properties with a cultural criterion, one point each** (the lowest Q number where Wikidata gives one id
   several items): components would let a long serial property count many times.
77. **The circle laid straight rather than on a globe**: one row a site reads on a phone, and the repo has no world
   coastline. Reversible: the strip is one function.
78. **On `ch9-story`, cued on "story", hold 3 s, no new words**: the sentence names the three readers and "one story",
   which the circle is part of in Hancock's books, so nothing is re-recorded. A spoken line is in For Stewart.
79. **Alison's Pyay is placed at Sri Ksetra**, the ancient city at Hmawza by Pyay, on the Payama stupa's point (one of the
   two its article prints; the Pyay article prints none). His point is about 45 km north of it, in no named site. If he
   meant a different work, the `own` block is one line.
80. **The timeline shares the strip's rows**, distance off the circle on the left and years on the right, so each site
   is read once and the figure still clears the narration on a phone. A year range is the work's as its source words
   it (built, carved, painted, occupied: the `what` field), centuries read as their years, BCE negative, open ends drawn
   faint.
81. **The capture lines the sound up by the player's own log, not by listening.** The page is muted (the laptop's
   speakers), so the recording cannot capture sound; the player writes when each span sounded in `Date` milliseconds
   and the script compares that with when the page (and so its video) opened, good to a frame or two. A leaf in the
   browser's voice is silent in the mp4 and named in its JSON rather than synthesised.
82. **The head's clean cut is a look choice, a metre in (2.5 under the chin)**, stated in `objectview.ts`: the export's own
   cut is the decimated mesh's ragged edge, and the heads are labelled stand-ins whose form is not a measurement, so
   trimming them further changes nothing claimed. Reversible: `HEAD_INSET` and `HEAD_INSET_BELOW` at 0 restore the
   export's edge.
83. **Lines computed in the page beside the renders' overlays** (`SCENE_OVERLAYS` in `wells.ts`): the wells' records are in
   the bundle, so drawing them needs no render, and the leaves test accepts these names beside `overlays.json`'s. Where
   the wells stand under the base is the same look choice the depth figure already makes, said on the label.
84. **Labels grow with the stage to 1.4 times, and step off a figure rather than the figure moving**: the figure is the
   leaf's subject; the label can move sideways and still point near its mark. A label stepped off its point loses the
   point under its plate at worst, which reads better than a label under a panel.

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

- Chapter 6's "how they did the math" (E22) is in as figures on the existing leaves. If you want it spoken too, a
  sentence for the script, to be re-recorded, might be: "Their own papyri teach the seked as a schoolroom exercise, but
  they were written centuries after the pyramids; no mathematics survives from the pyramid age itself." Say if you want
  it, and where.
- The three "if it held" lines (E23b, `data/structures.json`, field `if_it_held`) were drafted by the builder: worth a
  read, since they speak for the exhibit's tone. The Khafre one ends "the plateau's history would need rewriting, since
  nothing cut hundreds of metres into rock is known from ancient Egypt".
- Rhind problem 56's figures (E22b) are text like the king lists: whatever shape you choose for `data/texts/` would
  take them too.

- **E25, the Vulture Stone over the sky:** may the exhibit show Pillar 43's relief (the height map made from the
  excavators' drawing on Collins's page) on its public pages? `docs/gobekli-reliefs.md` keeps those references
  unpublished. The alternatives are an outline traced from the DAI's own published drawing with its permission, or
  the sky alone with the animals named. The claim also wants a claim file from Sweatman and Tsikritsis 2017 (their date
  and pairings, read from the paper).
- **E26, the world's pyramids:** which dataset? Wikidata is CC0 but thin (35 of 178 dated, modern ones mixed in, the
  Egyptian ones undated). Options: Wikidata with a stated rule (ancient classes only, dates from a second source);
  a published scholarly list, if you know one; or the proponents' own list of sites (the claim as they draw it), with
  dates from each site's own source. The fit and the chance reply are built and wait for the sites.

- Chapter 4's king-list totals (Turin's 13,420 and 23,200, Manetho's) want a new data file, `data/texts/kinglists.json`,
  as the script proposes, with a sentence in `CLAUDE.md` for the new unit (years in a text, not a measurement). The
  builder has not created it: is that the shape you want?

- **Pillar 43 in words?** (E25, chunk 11.) Chapter 7's narration does not mention the Vulture Stone; the script left
  Sweatman out for want of checked sources, and the paper is now read (C8). The chart is a figure on "carved with
  animals". If you want it spoken, a sentence for the script after that one might be: "Two researchers at Edinburgh read one pillar,
  the Vulture Stone, as a map of the sky dated to 10,950 BCE; by our reckoning the date they give misses their own reading
  by three centuries." It would mean re-recording chapter 7. Note the plan had their vulture as Cygnus; the paper says
  Sagittarius.

- **The great circle in words?** (E26b, chunk 12.) It is a figure on chapter 9's "one story" leaf, unspoken. If you
  want it said, a sentence for the script after that one might be: "Hancock's circle of world wonders passes close to
  ten World Heritage sites; a circle drawn at random passes about four, and one in eight does as well." It would mean
  re-recording chapter 9.

## Answers from the laptop session (21 October, about 05:10 UTC)

1. **E22's spoken line: yes.** Add the builder's sentence to chapter 6 of `docs/script.md` at the beat where the
   seked figure appears ("Their own papyri teach the seked as a schoolroom exercise, but they were written centuries
   after the pyramids; no mathematics survives from the pyramid age itself."), recut the leaves so every word stays
   in order, and leave a line under "For the laptop": the laptop re-records chapter 6 with
   `python scripts/narrate_script.py 6`.
2. **`data/texts/`: yes**, in the shape the script proposes (`data/texts/kinglists.json`, and Rhind problem 56 beside
   it), with a sentence in `CLAUDE.md` that a text's years and figures are what the text says, cited to its page,
   `verified: false`, never a measurement. Do E18c and E22b(a) on it.
3. **E26's sites: the proponents' own list** (the claim as they draw it: the great-circle sites as Hancock and
   Alison give them), each site's date and coordinates from that site's own source, `verified: false`; Wikidata only
   to fill coordinates. Then the fit and the chance reply as built.
4. **E25: our own reconstruction.** Draw the relief's outlines from our own height map (made from the drawing and
   Stewart's photographs) and label it "a reconstruction after the excavators' drawing (DAI)", never their drawing;
   provenance in the figure's manifest. Enter Sweatman and Tsikritsis 2017's date and pairings as a claim file read
   from the paper. E19b waits for the laptop's cleaned height maps: skip it.
5. **E2c and E21b:** do what the sources in the repo allow; leave what needs scans for later, said in the list.

## For the laptop

Renders the laptop session should run, with the queue or command, as items need them.

- **The critic's recording** (E27, `eef3ed5`): the whole exhibit runs about half an hour in real time, so run it detached:
  `python scripts/job.py start critic --then "look at build/critic/exhibit.mp4" -- python scripts/capture_exhibit.py --from ch0-dawn --to ch9-look --out build/critic/exhibit.mp4`
  (`ch9-look` is the last leaf). `pnpm bundle` first so the receipts draw. Its JSON
  names any leaf that is silent because its chapter's recording lacks it (`ch6-papyri` until chapter 6 is re-recorded).

- **Re-record chapter 6** (E22b d, `3265a38`): `python scripts/narrate_script.py 6`, then commit `assets/narration/ch6.*`
  and take `ch6-papyri` out of `AWAITING_RECORDING` in `apps/exhibit/src/narration.test.ts` (the test fails until you do).

- **The valley temple after E17c's move** (`59838a0`): `plan()` now lives in `render/giza/valley_plan.py`. Render
  `valley-temple` built once (or a preview) and compare with the current panorama: nothing should have moved. Then
  `python render/publish.py` rewrites `apps/walk/overlays.json` whole, `valley-sockets` included. If the sockets should
  be seen from in front, a station in the long hall's middle aisle, looking west between the two rows of statues, would
  show both rows with no pillar between; say if you want one and the builder will add it and move `ch3-statues` there.

- **`orion` First Time at `night-dark`** (already queued for E15) now also carries chapter 4's opening: until it is
  rendered, the walkthrough's `orion-first-time.jpg` stands in, and it shows the three pyramids in the First Time
  ("nothing stands yet" two leaves later). Worth rendering before Stewart sees chapter 4.

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
