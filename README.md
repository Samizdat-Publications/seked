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
from Petrie's positions in both the Blender scene and the browser, and its
four shafts are bores that bend: Gantenbrink's inlet runs and angles, the
northern shafts' dog-legs round the Grand Gallery, the slab 59 m up the
Queen's Chamber's southern shaft, and Petrie's mouths on the faces, with the
few figures only his drawings give entered as labelled estimates; Khafre's
and Menkaure's sheets carry Petrie's dimensions but he gives no positions,
so Khafre's descending corridor and burial chamber are placed from
Maragioglio and Rinaldi's published lengths, slope and levels, and
Menkaure's descending corridor from Petrie's entrance, their length and the
slope Perring measured for Vyse's 1840 table; his chambers wait on a level.
The Great Pyramid as it stands is
built course by course from Goyon's 1978 survey of its 201 courses, in
Blender and in the browser alike. The terrain is cut from Copernicus
GLO-30 with the ground under each pyramid set to its surveyed base level,
and a coarser ring of the same heightfield carries the horizon out to
12 km, so the renders no longer stop at the edge of the near grid.
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

The five chambers of construction over the King's Chamber are in, from
Petrie §62 and the table of dimensions in Vyse's second volume. Their levels
are the one thing in the Great Pyramid that is solved rather than stored:
nobody measured how thick the granite beams between them are, and Petrie
says outright that the beams are "very unequal in depth", so the stack is
closed instead against the one figure Vyse gives for the whole of it, 69 ft
3 in from the King's Chamber floor to the roof of Campbell's. That leaves
1.85 m a beam. Sharing it evenly is the only assumption in the five.

The ScanPyramids North Face Corridor is in too, out of Procureur and the
others' 2023 paper, and it is the first solid here that nobody has stood in.
Its size is theirs to a few centimetres, with their error bars; where it
stands is derived, its east-west axis being the descending corridor's, which
the paper states, and its north end standing 0.84 m behind the north face at
its own mid-height, the Chevron standing in that face. The section draws it
as an outline with no fill, because a shape fitted to a muon deficit should
not read like a room with a floor.

A verification pass on the shafts, 2026-09-16, closed the open question in
`kc.shaft.north.angle`'s own note and turned up two things. The Upuaut
report's upper northern shaft page settles the angle outright: "The angle
between this point and the point of the shaft's outlet on the flank of the
pyramid (we measured both points) is 32.60°", which is 32° 36′, so the
stored figure is the report's and not Bauval's 32° 28′. Three of claim
C2's four shaft angles are now verified against the report's text.

The fourth is not, and cannot be. `qc.shaft.north.angle` was entered on the
starting sheet as 39° 07′ and **the report does not state it**. What the
lower northern shaft page gives is a fluctuation, "between 33.3° and 40.1°"
over 14 measurements, and an explicit refusal to name the intended angle. The
two measured bounds are now recorded beside it; the old value is left in place
and unverified rather than changed, because claim C2 draws a ray from it and
which replacement the claim should use is a decision rather than a correction.

The second finding was cheaper to fix. All four shaft inlet positions were
estimates reading "the middle of the chamber wall", entered because
"Gantenbrink's inlet positions are on his drawing and not in his text". They
are in his text, on the findings page rather than the four shaft pages. The
King's Chamber southern inlet moves 2.75 m east onto his measured 2.49 m, and
its computed outlet moves with it to within 0.16 m of the 5.20 m east of the
axis that the same page measures, which is about what his east-wall convention
costs. Those outlet figures are now in the database purely as a check: nothing
is built from them, and the one end-to-end test the shafts have compares them
with a run the scene computes. The northern shaft still misses, its dog-leg
round the Grand Gallery being two estimates, and the test says so rather than
only reporting the shaft that agrees.

The Big Void is in as well, and it is the clearest case in the project of a
solid built out of sentences rather than coordinates. Morishima and the
others' 2017 paper states no position for it anywhere in its text. It says
the void is above the Grand Gallery, that its cross section is comparable to
the Gallery's, that it is at least 30 m long, and that its centre lies
between 40 m and 50 m from the floor of the Queen's Chamber. That is enough:
"above the Grand Gallery" fixes two coordinates and the distance fixes the
third, which lands 61.5 m over the pavement, ten metres over the Gallery's
roof. The paper says the void "could be inclined or horizontal" and leaves it
there, so both are drawn on the one solved centre and neither is preferred.
The figures carry more, and a position read off a figure by eye is not a
measurement, so none was.

Next, in order, each from a public source checked on 2026-09-14: the rest of
the Great Pyramid's section (the Gallery's real corbel laps, for which §46
gives the eight laps' plumb offsets but only Smyth's one lap height, so the
heights still need a source; and the well shaft and grotto from the Edgars,
which Petrie declines to measure in §46, saying it is "not worth while to
publish more complete measures than those of Prof. Smyth"); Menkaure's
chambers
hung off the foot of his corridor from Vyse's table and Petrie's dimensions;
the Tier 3 masses from OpenStreetMap's footprints, which name the queens'
pyramids, the temples, the causeways, the Wall of the Crow, Khentkawes and
the boat pits, with the Sphinx built up from its plan outline there in place
of the box; Khafre's casing cap as a labelled estimate; and the cinematic
re-rendered at hero quality once the plateau under it is finished. What no
public source gives (a shaft inlet's exact place in a wall, a bent leg's
length, a chamber level) is entered as an estimate on its own source, with a
sigma, and stays unverified until a figure turns up.

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
scripts/       dossier generator, shaft solver, star import, web bundle, terrain cutter, site assembly, render log
docs/          plan.html, dossier.md, shafts.md, progress/ (chosen snapshots) and progress/log/ (every render, stamped and indexed)
.github/       the Pages workflow: tests, typecheck, site assembly, deploy when PAGES_ENABLED is true
```
