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
- [ ] **E4. The changes.** (a) The era wipe in the panorama shader: a hard, slightly soft-edged boundary sweeping
  across the view, the new era behind it; animated in play, draggable when paused. (b) Lines that draw on, each
  timed to the word that names it. (c) Flights: when a leaf arrives by `flight`, play
  `flights/<from>--<to>.mp4` full screen and hand over to the panorama on its last frame, the panorama already
  set to the leaf's view; until a flight is rendered, a `cut`.
  *(a) done 2026-10-20 16:06 UTC, `25de84b`:* the shader draws the new era left of a hard, slightly slanted edge
  with a faint light on it, crossing in 1.8 s once both pictures are in; the player wipes whenever the next leaf
  is the same station and moment in another era. Paused on an `era` leaf, a grip waits at the right edge ("Drag
  for Today") and brings back the era the panorama was last in. Checked mid-sweep and dragged at both sizes.
  (b) and (c) remain.
- [ ] **E2b. The flank's lines.** Chapter 1 promises the profile, the fissures, the seismic lines and the
  weathered slab drawn on the scene, but `overlays.json` has none at `sphinx-flank`. Write them as overlays from
  the database (`sphinx.enclosure.margin.*`; the seismic lines placed from Reader's Fig. 5 and labelled so, as the
  script's beats say), in `render/publish.py`'s manner or a small script beside it, and name them in the leaves'
  `draw`. Numbers only from `data/`; anything scaled or guessed says so on screen.
- [ ] **E5. The receipt and the reply.** A small tab at the edge of the screen on every leaf that has them: the
  claim's receipt computed live from the bundle (port `apps/story`'s receipts), and the archaeologists' reply
  from `docs/script.md`, in a quieter type. Closed by default.
- [ ] **E6. The render queue from the leaves.** `scripts/exhibit_queue.py` writes, from `leaves.json`:
  `render/queues/exhibit-panos.json` (each leaf's station in its era and moment that `apps/walk/pano/` lacks) and
  `render/films-exhibit.json` (a flight for each leaf that arrives by `flight`: from the last leaf's station
  camera and view to this one's, the arriving leaf's era and moment, about 3 s at 30 fps, 1920 by 1080, 64
  samples, a smooth eased path that rises over obstacles). Teach `render/build.py --film` to read a films file
  other than `render/films.json` (`--films PATH`). Unit tests for the path maths; do not render.
- [ ] **E7. The narration script, not run.** `scripts/narrate.py`: for each leaf, ElevenLabs text to speech with
  timestamps (model and voice as arguments; the key from `ELEVENLABS_API_KEY`), writing
  `apps/exhibit/audio/<leaf>.mp3` and `<leaf>.words.json`, skipping a leaf whose text has not changed (hash). The
  player prefers the recording when it exists. Port what helps from Stewart's Antikythera project
  (`C:\Users\stewa\Documents\Claude\Blender Tests\antikythera\tools\narration.py`; read only, never write there).
- [ ] **E8. Look at it end to end** at both sizes, as a visitor with no background would, and fix what reads
  badly. Write what still needs a render or a decision under "For Stewart" and "For the laptop".

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


## For Stewart

- The cold open says "from the rooftops of Nazlet el-Samman" but stands at `sphinx`, above the Sphinx temple. A
  rooftop station east of the temple (and the rise over the roofs the script's beat describes) would make it
  true; until then, should the words change to fit the picture? (Decision 5.)

## For the laptop

Renders the laptop session should run, with the queue or command, as items need them.

- Five panoramas at `equinox-dawn` for the prototype (decision 4): `sphinx` today, `sphinx-face` today,
  `sphinx-flank` today, long rains and First Time, each to `apps/walk/pano/<station>-<era>-equinox-dawn.jpg`.
  E6 writes the queue; until then this line is the request. Worth a look whether the flank's floor is too dark
  at that hour; if so, say, and the chapter 1 leaves can move to `morning-east` with the flight in becoming a cut.
