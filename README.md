# Seked

A survey-accurate 3D model of the Giza necropolis in which every "encoded
mathematics" claim (π and φ in the profile, the 1:43,200 Earth scale, the
Orion Correlation, the shaft alignments, and the rest) is a live overlay,
computed from the same measurements that build the geometry.

*Seked* is the Egyptian unit of slope: palms of run per cubit of rise. A seked
of 5½ is the whole π-and-φ story. The name is a placeholder.

## The idea

Numbers first, then the model. Every dimension lives in a database with its
source and uncertainty. The geometry is generated from those numbers. Each
claim is a formula over the same numbers, so the app shows the fit rather
than asserting it. Switch the survey preset from Petrie 1883 to Dash 2015,
nudge the cubit, drag the sky back to 10,500 BCE, and watch each claim's
residual move.

Five rules:

1. **One source of truth.** Every number has provenance.
2. **Claims are data.** A claim is a file: inputs, formula, target, tolerance, sources, overlay.
3. **Two monuments.** "As built" (reconstructed, with error bars) and "as today".
4. **Show the fit.** Measured, claimed, residual, and a count of the free choices the claim needed.
5. **One frame.** Origin at the Great Pyramid's base centre, east-north-up, georeferenced to WGS84.

## Plan

The full project plan, with the measurement starting sheet, the claims
registry, the sky-engine spec, the architecture, the Blender pipeline, the
phases and the sourcing check, is in [`docs/plan.html`](docs/plan.html).

## Status

Phases 0 and 1 are done, Phase 4 is closed, and Phases 2, 3 and 5 are
under way. Every Petrie 1883 record for all three pyramids and the Dash
2015 records are verified against the source page, and so are Cole's 1925
sides and azimuths, read from a scan of the Survey of Egypt paper. The Great Pyramid's interior is generated
from Petrie's positions in both the Blender scene and the browser; Khafre's
and Menkaure's sheets carry Petrie's dimensions but he gives no positions,
so Khafre's descending corridor and burial chamber are placed from
Maragioglio and Rinaldi's published lengths, slope and levels, while
Menkaure's wait on a citable slope. The Great Pyramid as it stands is
built course by course from Goyon's 1978 survey of its 201 courses, in
Blender and in the browser alike. The terrain is cut from Copernicus
GLO-30 with the ground under each pyramid set to its surveyed base level.
The sky package is checked against Stellarium 26.2: transit altitudes
agree to within 25 arcseconds for five stars at 2500, 2450 and 10,500
BCE, and the one disagreement, Sirius, is a proper-motion difference
between catalogues that the test states rather than hides
(see [`docs/stellarium.md`](docs/stellarium.md)). Blender renders are lit
from the same package: a script bakes the sun and the star dome, and the
render script lights four views from it under a physical sky. A second bake
writes every bright star's place at each of the 480 frames of the plan's
sky-rollback cinematic, and a Blender script films it: the sky from 2000 CE
back to 10,500 BCE with Alnitak held on the meridian, the King's Chamber's
south shaft drawn out of the pyramid at its measured angle, and the star
sliding into its line of sight at 2450 BCE, which is claim C2 as a film.
Menkaure's lowest sixteen courses and the foot of Khafre's render as granite
from two verified Petrie records. All twenty-two claims of the plan's table compute, C7 on the
Orion engine with Collins's Cygnus stars, D3 against cited positions for
the Delta, D4 from Nell and Ruggles's 2014 survey of the temples at the
Sphinx's feet. Every overlay a claim declares now draws, and a test says
so: the ghost profiles, the King's Chamber wireframe, the casing and socket
outlines, the compass rose, the shaft and passage rays, the Orion and
Cygnus projections, the bearings from the Sphinx and from the Great
Pyramid, Legon's rectangle, the Heliopolis line, the ghost Earth, and B3's
three parallels with the Egypt 1907 datum shift beside the WGS84 one. The
web viewer builds the same meshes in the browser, with live preset, cubit
and epoch controls, a section cut, a fly camera, a star dome at any epoch
and sidereal time, a dated sun, and a twelve-step narrated tour. Milestone
renders and screenshots are collected in
[`docs/progress/`](docs/progress/README.md), and a GitHub Pages workflow
assembles the viewer, the snapshots and the documents into one site.

```
pnpm install
pnpm test        # 441 tests across units, geometry, data, claims, sky, the viewer, the scripts and the Blender reader
pnpm typecheck   # the packages, the scripts and the viewer
pnpm dossier     # regenerates docs/dossier.md from data/
pnpm shafts      # solves the shaft alignment epochs into docs/shafts.md
pnpm run stars   # rebuilds data/stars/ from the HYG 4.2 catalogue (run, not a bare pnpm stars)
pnpm run courses # rebuilds data/measurements/g1-courses.json from Goyon 1978's transcription
pnpm sky-bake    # writes build/sky-bake.json, the sun and the stars for Blender
pnpm sky-rollback # writes build/sky-rollback.json and .f32, the stars frame by frame for the cinematic
pnpm bundle      # writes apps/web/public/seked.json for the viewer
pnpm dev:web     # the viewer on a Vite dev server
pnpm build:web   # static site in apps/web/dist
pnpm site        # the Pages site: viewer, progress snapshots and documents, in site/
```

Blender is driven headless (5.1, usually not on PATH; see
[`blender/README.md`](blender/README.md)):

```
blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb
blender -b build/seked.blend -P blender/check.py
blender -b build/seked.blend -P blender/render.py -- --view dawn --out build/hero.png
blender -b build/seked.blend -P blender/rollback.py -- --out build/rollback --mp4 build/rollback.mp4
```

`packages/sky` carries Vondrák 2011 long-term precession, tested against
ERFA's reference values, the horizon frame, the equinox and solstice sun
from the obliquity of date, a calendar to put a date on it (Julian Days in
the proleptic Julian and Gregorian calendars, ΔT from the Stephenson,
Morrison and Hohenkerk long-term parabola, sidereal time, Meeus's
low-precision solar position, the equation of time and the instants of the
four seasons, all checked against his own worked examples), and enough
meridian geometry to solve the shaft alignments; see `docs/shafts.md`.
`skyEnvironment` flattens it into `star.<id>.ra`, `.dec`,
`.transit.altitude`, `.rise.azimuth`, `sun.*` and similar keys, among them
`sun.june_solstice.jd` and the local mean times of that morning's sunrise
and sunset, so a claim that names an `epoch` can reach the sky from its
YAML without the claims package learning any astronomy.

Next: a citable slope for Menkaure's descending corridor so his interior
can build; the GPMP contours for the ground; and the Blender work the
plan's hero renders need, which is where the project's visual weight
lands: the Sphinx sculpt in place of the massing placeholder, richer
materials on the cased faces and the exposed courses, the horizon beyond
the 6 km grid, the night render's exposure, and the sky-rollback cinematic
with star positions baked from `packages/sky`.

## Layout

```
data/
  sources.json          every source a record or a claim may cite
  sites.json            sites with body, datum and origin (giza; a cydonia placeholder on Mars)
  structures.json       every structure with an evidence tier: excavated, instrumented, claimed, legendary
  presets.json          preference orders over sources (canonical, petrie-1883, cole-1925, dash-2015)
  measurements/*.json   one record per measured quantity, metres and degrees, with provenance
  claims/*.yaml         one claim per file: comparisons, tolerance, free choices, sources, overlay
  stars/                the fourteen named stars and the HYG 4.2 catalogue to magnitude 6.5 (imported, never typed)
  terrain/              the GLO-30 heightfield around Giza in the project frame (the tiles are not tracked)
packages/
  units/       cubit, pyramid inch, seked <-> degrees, DMS formatting
  geometry/    pyramid profile numbers, eight-sided mesh generator, interior solids, ground, landmarks, expression environment
  data/        zod-validated loader, preset resolver, terrain reader, Blender parity tests
  claims/      expression parser (no eval), registry, evaluator, dossier renderer
  sky/         Vondrák 2011 precession (ERFA-verified), horizon frame, sun, star dome, named stars, claim environment
blender/       generate.py (the scene from data/), seked_data.py (stdlib reader and mesh mirrors), check.py, render.py
apps/web/      Vite + React + React Three Fiber viewer
scripts/       dossier generator, shaft solver, star import, web bundle, terrain cutter, site assembly
docs/          plan.html, dossier.md, shafts.md, progress/
.github/       the Pages workflow: tests, typecheck, site assembly, deploy when PAGES_ENABLED is true
```
