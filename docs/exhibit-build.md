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

- [ ] **E1. `apps/exhibit`, the player ported.** A Vite + TypeScript app (no React, as `apps/story`), served at
  `/exhibit/` by `pnpm site` beside `/walk/`. Port `apps/walk/index.html`'s WebGL2 panorama viewer into modules:
  equirectangular panoramas centred on true north, drag and wheel to look, the detail patches, the registered
  overlays (`overlays.json`, 3D lines projected from the station camera). Panoramas load from the same files
  `/walk/` uses. Full screen, nothing but the picture and a quiet caption band. Tests for the projection maths.
- [ ] **E2. The leaves.** `apps/exhibit/leaves.json` with the schema in the plan ("The leaves file"), a loader that
  validates it (zod, as `@seked/data`) and tests. Cut chapters 0 and 1 of `docs/script.md` into leaves, one or
  two sentences each, every word of those chapters kept in order. Choose each leaf's station, era, moment and
  view from `render/stations.json` so the story is told by where we stand: the cold open from the east over
  Nazlet el-Samman to the Sphinx's face at dawn; chapter 1 at `sphinx-flank`, the ditch wall. Follow the plan's
  rule: two leaves joined by a flight share an era and a moment. Log each choice.
- [ ] **E3. Narrated play.** Play, pause, next, previous, a chapter list. Each leaf speaks its words (the
  browser's `speechSynthesis` until the recorded voice exists, with its word-boundary events as the timing),
  shows them as a caption, holds, then moves on. Any drag or key pauses play and hands the visitor the view;
  play resumes from that leaf. The state is in the address (`?leaf=ch1-flank`), as the Antikythera exhibit's is.
- [ ] **E4. The changes.** (a) The era wipe in the panorama shader: a hard, slightly soft-edged boundary sweeping
  across the view, the new era behind it; animated in play, draggable when paused. (b) Lines that draw on, each
  timed to the word that names it. (c) Flights: when a leaf arrives by `flight`, play
  `flights/<from>--<to>.mp4` full screen and hand over to the panorama on its last frame, the panorama already
  set to the leaf's view; until a flight is rendered, a `cut`.
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

## For Stewart

## For the laptop

Renders the laptop session should run, with the queue or command, as items need them.
