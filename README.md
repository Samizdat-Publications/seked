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

Phase 0 (foundation) is in. The measurement database, the units and geometry
packages, the claims registry with its expression evaluator, and the dossier
generator exist and are tested. Nothing has been verified against a primary
source yet: every record carries `verified: false` until someone checks it
against the cited page. Open decisions are listed at the end of the plan.

```
pnpm install
pnpm test        # 52 tests across units, geometry, data, claims, sky and the Blender reader
pnpm dossier     # regenerates docs/dossier.md from data/
pnpm shafts      # solves the shaft alignment epochs into docs/shafts.md
```

`packages/sky` carries Vondrák 2011 long-term precession, tested against
ERFA's reference values, and enough meridian geometry to solve the shaft
alignments (claim C2); see `docs/shafts.md`.

Next: verify the starting sheet against Petrie, Cole and Dash; let claims
call the sky engine so C2, C3 and C4 appear in the dossier; then terrain,
interiors and materials in Blender, and the web viewer.

## Layout

```
data/
  sources.json          every source a record or a claim may cite
  presets.json          preference orders over sources (canonical, petrie-1883, cole-1925, dash-2015)
  measurements/*.json   one record per measured quantity, metres and degrees, with provenance
  claims/*.yaml         one claim per file: comparisons, tolerance, free choices, sources, overlay
packages/
  units/       cubit, pyramid inch, seked <-> degrees, DMS formatting
  geometry/    pyramid profile numbers, eight-sided mesh generator, landmarks, expression environment
  data/        zod-validated loader and preset resolver
  claims/      expression parser (no eval), registry, evaluator, dossier renderer
  sky/         Vondrák 2011 precession (ERFA-verified), meridian geometry, named stars
blender/       (planned) bpy generators, terrain import, export, .blend scenes
apps/web/      (planned) Vite + React + React Three Fiber viewer
scripts/       dossier generator, shaft solver
docs/          plan.html, dossier.md, shafts.md
```
