# Seked

A survey-accurate 3D model of the Giza necropolis in which every "encoded
mathematics" claim is a live overlay computed from the measurement database.
The full plan is `docs/plan.html`; the generated claims dossier is
`docs/dossier.md`.

## Commands

```
pnpm install        # once
pnpm test           # vitest, all packages
pnpm typecheck      # tsc --noEmit
pnpm dossier        # regenerate docs/dossier.md from data/
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
- **Claims are data.** One YAML file per claim in `data/claims/`. A claim is
  inputs, formulas, targets, tolerance, free choices, sources and an overlay
  spec. Adding a claim never touches package code.
- **Presets are preference orders over sources.** `resolve(db, presetId)`
  picks, for each key, the record from the earliest source in the preset's
  list. Switching preset regenerates everything downstream.
- **One frame.** Origin at the Great Pyramid's base centre; +X east, +Y
  north, +Z up in data, geometry and Blender. The glTF exporter handles
  Y-up for the web.
- **Blender scripts** (`blender/`) run inside Blender's own Python. Keep them
  dependency-free and have them read `data/` directly.

## Layout

```
data/            measurements, sources, presets, claims
packages/units   cubit, pyramid inch, seked <-> degrees, DMS formatting
packages/geometry  pyramid profile numbers, mesh generator, landmarks, expression environment
packages/data    zod-validated loader and preset resolver
packages/claims  expression parser, claim registry, evaluator, dossier renderer
scripts/         dossier generator
docs/            plan, dossier
```
