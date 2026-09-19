# Seked

A survey-accurate 3D model of the Giza necropolis in which every "encoded
mathematics" claim is a live overlay computed from the measurement database.
The full plan is `docs/plan.html`; the generated claims dossier is
`docs/dossier.md`.

## What this is for

A test of how beautiful a fully Claude-driven scene of the Giza plateau can be:
modelled, lit, textured and given atmosphere, the pyramids above all, inside
and out, under a correctly mapped sky, and still able to test a claim. It is
"as close to survey as we can get, with the holes filled in", not a survey for
its own sake. The pyramids stay as near survey as the sources allow, because
they are what the claims are about. Everything else (temples, tombs, the
Sphinx, causeways) needs its placement right, which the OSM registration
gives to about a metre, and may use a good free 3D model fitted to its
footprint and labelled as a visual stand-in. Filled-in parts are fine and are
said to be filled. Render quality is a deliverable, not polish. Later: a tour
of the star alignments, and an LLM that runs claims such as Hancock's against
the sim. The next round's plan is `docs/geometry-blockers.md`.

## Commands

```
pnpm install        # once
pnpm test           # vitest, all packages
pnpm typecheck      # tsc --noEmit
pnpm dossier        # regenerate docs/dossier.md from data/
pnpm shafts         # solve the shaft alignment epochs into docs/shafts.md
pnpm run stars      # re-import HYG 4.2 into data/stars/ (npm owns the bare `pnpm stars`)
pnpm run footprints # re-import the plateau's lesser monuments from OSM into data/footprints/
pnpm run city        # re-import the modern city from Open Buildings into data/footprints/city.* (1.3 GB streamed; caches in build/city/)
pnpm claim -- "<prose>"      # put a claim in somebody's own words to the model; writes build/claims/ only, never data/ (ANTHROPIC_API_KEY in ~/.seked/keys.env)
pnpm run deploy     # build the viewer, assemble site/, upload to Cloudflare Pages (https://seked.pages.dev); pnpm owns the bare `pnpm deploy`
pnpm sky-bake       # bake the sun and the star dome into build/ for blender/render.py
pnpm sky-rollback   # bake the cinematic's star positions, frame by frame, for blender/rollback.py
python scripts/models.py     # fetch the stand-in models in blender/models.json from Sketchfab into build/models/ (token in ~/.seked/keys.env)
python scripts/textures.py   # fetch the CC0 Poly Haven texture sets in blender/textures.json into build/textures/ (md5-checked)
python scripts/plate.py render|grid|scale|measure|register   # read a drawing: native scan, pixel grid, scale bar, scaled figure with its sigma
python scripts/meshy.py generate ID [--tag T]   # generate a stand-in in blender/models.json from CC0 photographs with Meshy (MESHY_API_KEY in ~/.seked/keys.env)
python scripts/job.py claim|start|status        # own the repo, run a long job detached from the session, see who owns what (see "One session at a time")
```

## Rules that keep the project honest

- **Nothing is typed twice.** Every number lives in `data/measurements/*.json`
  with a `source` that exists in `data/sources.json`. Derived quantities
  (perimeter, apothem, volume) are never stored; `@seked/geometry` computes
  them, so they cannot drift from their inputs.
- **Units are metres and degrees** in the database and in the expression
  environment. Inch values from Petrie go in as metres with the inch figure
  in `note`. Cubits and pyramid inches are display and claim units only.
- **`verified: false` is the default.** A record becomes `verified: true`
  only after someone has checked it against the cited page of the source.
  The starting sheet was entered from memory and secondary sources.
- **Star data is imported, never typed.** Everything in `data/stars/` is
  written by `pnpm run stars` out of one HYG 4.2 CSV: `hyg-bright.json` is the
  catalogue to magnitude 6.5, `named.json` the fourteen stars the claims name, cut
  from the same rows so the two cannot disagree. The raw CSV is gitignored and
  `data/sources.json` carries its URL, its checksum and the CC BY-SA 4.0
  attribution the licence requires.
- **The modern city is context, not evidence.** The buildings of Giza and
  Cairo behind the `today` state carry no evidence tier and are never cited
  by a claim: the plateau is what this project is about, and an apartment
  block is the view behind it. But context is still imported and never
  invented. Footprints come from Google's Open Buildings v3 (CC BY 4.0 or
  ODbL, Egypt covered) rather than OSM, which has only about 7,300 buildings
  in the whole 9 by 11 km box east of the plateau and 98 per cent of those
  with no height of any kind; heights come from the Open Buildings 2.5D
  Temporal height raster, 4 m effective resolution and a stated mean absolute
  error of 1.5 m, which is a measurement with an error bar like any other.
  OSM keeps the ancient monuments it already carries. A building the height
  raster cannot give is drawn at a stated look-choice height or not at all,
  and which of those it is, is said in the file. (Agreed with Stewart
  2026-09-18; the sources found and the rule narrowed the same day, after the
  first version of it assumed every height would have to be invented.)
- **Footprints are imported, never typed.** `data/footprints/giza.json` is
  written by `pnpm run footprints` from OpenStreetMap, fitted onto the three
  surveyed pyramids (its header carries the residuals) and set on the scene's
  ground. A height OSM does not tag is a measurement key, not a number in the
  file.
- **Drawings are read two ways, never by eye.** A dimension printed on a
  plate is transcribed like any figure from a table, cites the plate, and is
  verified once checked against the image. A distance scaled off a plate
  against its own scale bar has `method: "scaled from plate"`, names the
  plate and the scale bar, carries a sigma summing the scan's pixel
  resolution, the drafting tolerance and the scan's shrinkage, and is never
  verified. A position guessed from how a picture looks is still not a
  measurement. (Agreed 2026-09-16.)
- **Visual stand-ins are labelled.** A third-party model used for a
  non-pyramid structure is placed on that structure's footprint, keeps its
  licence and source in a manifest, and is marked a stand-in wherever it is
  shown; nothing about its form is entered as a measurement.
- **Claims are data.** One YAML file per claim in `data/claims/`. A claim is
  inputs, formulas, targets, tolerance, free choices, sources and an overlay
  spec. Adding a claim never touches package code.
- **Presets are preference orders over sources.** `resolve(db, presetId)`
  picks, for each key, the record from the earliest source in the preset's
  list. Switching preset regenerates everything downstream.
- **Sites and evidence tiers.** `data/sites.json` names each site, its body
  and datum, so nothing assumes Giza or Earth. `data/structures.json` gives
  every structure an evidence tier: `excavated`, `instrumented` (muon, GPR,
  seismic, peer reviewed), `claimed` (not peer reviewed) or `legendary`. The
  viewer renders tiers differently; a claim may reference any tier. Never
  promote a tier because a claim needs it.
- **One frame.** Origin at the Great Pyramid's base centre; +X east, +Y
  north, +Z up in data, geometry and Blender. The glTF exporter handles
  Y-up for the web.
- **Blender scripts** (`blender/`) run inside Blender's own Python. Keep them
  dependency-free and have them read `data/` directly.
- **Precession is Vondrák 2011**, never the IAU 2006 polynomials, for anything
  before about 1000 BCE. The tests pin the implementation to ERFA's values.

## One session at a time

Twice a session was continued in a new one while a render it had started
was still running. The render was that old session's background task, so
when it finished it woke the old session, which did the render's wrap-up in
the same files the new session was committing (0016 got two rows). So:

- **Claim the repo first.** `python scripts/job.py claim <session name>`
  (ListAgents prints this session's name). The SessionStart hook prints the
  owner and every job; if another session owns the repo and is still open,
  message it to stand down before editing.
- **Long jobs run detached, never as a session's background task.**
  `python scripts/job.py start <name> --then "<what to do when it ends>" --
  <command>`. Its exit wakes nobody; the owning session checks
  `python scripts/job.py status` and does the `then`. Anything over about
  ten minutes (film renders, hero stills, big bakes) goes through it.
- **A session woken by a task, a monitor or a message checks the owner
  before touching the repo**, and if it is not the owner it only reports.
- **Commit named paths**, never `git add -A`, so one session cannot sweep
  another's half-done files into its commit.

## Layout

```
data/            measurements, sources, presets, claims
packages/units   cubit, pyramid inch, seked <-> degrees, DMS formatting
packages/geometry  pyramid profile numbers, mesh generator, landmarks, expression environment
packages/data    zod-validated loader and preset resolver
packages/claims  expression parser, claim registry, evaluator, dossier renderer
packages/sky     Vondrák 2011 precession, meridian and horizon geometry, star catalogue (data/stars/)
blender/         generate.py (bpy) and seked_data.py (stdlib reader, parity-tested against @seked/data)
scripts/         dossier and shaft-solver scripts
docs/            plan, dossier
```
