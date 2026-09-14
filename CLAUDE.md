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
pnpm shafts         # solve the shaft alignment epochs into docs/shafts.md
pnpm run stars      # re-import HYG 4.2 into data/stars/ (npm owns the bare `pnpm stars`)
pnpm sky-bake       # bake the sun and the star dome into build/ for blender/render.py
pnpm sky-rollback   # bake the cinematic's star positions, frame by frame, for blender/rollback.py
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
