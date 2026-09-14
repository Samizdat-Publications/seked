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

Phases 0 and 1 are done and Phases 2 and 3 are well under way. Every
Petrie 1883 record for all three pyramids and the Dash 2015 records are
verified against the source page; the Cole 1925 records wait for a copy of
the paper. The Great Pyramid's interior is generated from Petrie's positions
in both the Blender scene and the browser; Khafre's and Menkaure's sheets
carry Petrie's dimensions but he gives no positions, so their interiors wait
on published plans. The terrain is cut from Copernicus GLO-30 with the ground
under each pyramid set to its surveyed base level. Nineteen claims compute,
including all of group C through the Vondrák precession model, the HYG 4.2
star catalogue and an equinox-and-solstice sun; C7, D3 and D4 remain rows in
the plan. The web viewer builds the same meshes in the browser, with live
preset, cubit and epoch controls, a section cut, a fly camera, a star dome
at any epoch and sidereal time, and overlays for the sky claims and the
ghost profiles. Milestone renders and screenshots are collected in
[`docs/progress/`](docs/progress/README.md), and a GitHub Pages workflow
assembles the viewer, the snapshots and the documents into one site.

```
pnpm install
pnpm test        # 276 tests across units, geometry, data, claims, sky, the web bundle and the Blender reader
pnpm typecheck   # the packages, the scripts and the viewer
pnpm dossier     # regenerates docs/dossier.md from data/
pnpm shafts      # solves the shaft alignment epochs into docs/shafts.md
pnpm run stars   # rebuilds data/stars/ from the HYG 4.2 catalogue (run, not a bare pnpm stars)
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
```

`packages/sky` carries Vondrák 2011 long-term precession, tested against
ERFA's reference values, the horizon frame, the equinox and solstice sun
from the obliquity of date, and enough meridian geometry to solve the shaft
alignments; see `docs/shafts.md`. `skyEnvironment` flattens it into
`star.<id>.ra`, `.dec`, `.transit.altitude`, `.rise.azimuth`, `sun.*` and
similar keys, so a claim that names an `epoch` can reach the sky from its
YAML without the claims package learning any astronomy.

Next: verify Cole 1925 once the paper is to hand; positions for Khafre's and
Menkaure's interiors from published plans; the GPMP contours for the ground;
the Sphinx sculpt in place of the massing placeholder; claims C7, D3 and D4;
the remaining overlays (A4's chamber wireframe, B1's ghost Earth, B3's map
inset, B4's socket outline, D1's line and D2's rectangle); tour mode; a
calendar for the Sun (UT1 and delta T) so dated events get clock times; and
the Stellarium check of Alnitak's transit at 2500 and 10,500 BCE.

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
