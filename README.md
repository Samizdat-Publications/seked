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

Phase 0 is done and Phase 1 is in. Every Petrie 1883 record and the Dash
2015 records are verified against the source page; the Cole 1925 records
wait for a copy of the paper. The Great Pyramid's interior is generated from
Petrie's positions, the terrain is cut from Copernicus GLO-30, and the
Blender scene has a check script and a headless renderer. All seventeen
claims compute, including the sky claims C1 to C4 through the Vondrák
precession model and Legon's rectangle (D2); D1 still waits on a
georeferenced obelisk. The web viewer builds the same meshes in the browser
with live preset and cubit controls and the first overlay. Milestone renders
and screenshots are collected in [`docs/progress/`](docs/progress/README.md).

```
pnpm install
pnpm test        # 145 tests across units, geometry, data, claims, sky, the web bundle and the Blender reader
pnpm typecheck   # the packages, the scripts and the viewer
pnpm dossier     # regenerates docs/dossier.md from data/
pnpm shafts      # solves the shaft alignment epochs into docs/shafts.md
pnpm bundle      # writes apps/web/public/seked.json for the viewer
pnpm dev:web     # the viewer on a Vite dev server
pnpm build:web   # static site in apps/web/dist
```

Blender is driven headless (5.1, usually not on PATH; see
[`blender/README.md`](blender/README.md)):

```
blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb
blender -b build/seked.blend -P blender/check.py
blender -b build/seked.blend -P blender/render.py -- --view dawn --out build/hero.png
```

`packages/sky` carries Vondrák 2011 long-term precession, tested against
ERFA's reference values, and enough meridian geometry to solve the shaft
alignments; see `docs/shafts.md`. `skyEnvironment` flattens it into
`star.<id>.ra`, `.dec`, `.transit.altitude` and `.lower.altitude` keys, so a
claim that names an `epoch` can reach the stars from its YAML without the
claims package learning any astronomy.

Next: verify Cole 1925 once the paper is to hand; enter the subterranean
passages' own section and the gallery's corbel heights from Petrie; replace
the ground under the monuments with the GPMP contours; interiors for Khafre
and Menkaure from published plans, and the Sphinx; the remaining overlays,
the sky dome and its time scrubber in the viewer; claims C5 to C7, D1, D3 and
D4; and the Stellarium check of Alnitak's transit at 2500 and 10,500 BCE.

## Layout

```
data/
  sources.json          every source a record or a claim may cite
  sites.json            sites with body, datum and origin (giza; a cydonia placeholder on Mars)
  structures.json       every structure with an evidence tier: excavated, instrumented, claimed, legendary
  presets.json          preference orders over sources (canonical, petrie-1883, cole-1925, dash-2015)
  measurements/*.json   one record per measured quantity, metres and degrees, with provenance
  claims/*.yaml         one claim per file: comparisons, tolerance, free choices, sources, overlay
  stars/named.json      the named stars the sky claims use
  terrain/              the GLO-30 heightfield around Giza in the project frame (the tiles are not tracked)
packages/
  units/       cubit, pyramid inch, seked <-> degrees, DMS formatting
  geometry/    pyramid profile numbers, eight-sided mesh generator, interior solids, landmarks, expression environment
  data/        zod-validated loader, preset resolver, terrain reader, Blender parity tests
  claims/      expression parser (no eval), registry, evaluator, dossier renderer
  sky/         Vondrák 2011 precession (ERFA-verified), meridian geometry, named stars, claim environment
blender/       generate.py (the scene from data/), seked_data.py (stdlib reader and mesh mirrors), check.py, render.py
apps/web/      Vite + React + React Three Fiber viewer
scripts/       dossier generator, shaft solver, web bundle, terrain cutter
docs/          plan.html, dossier.md, shafts.md, progress/
```
