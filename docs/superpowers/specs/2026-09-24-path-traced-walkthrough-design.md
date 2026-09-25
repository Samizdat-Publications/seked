# The path-traced walkthrough

Design, 2026-09-24. Supersedes the realtime half of
`2026-09-17-realtime-plateau-design.md`. The case made to Stewart, with the proof
renders, is the artifact https://claude.ai/artifact/T3KjtoXBU4HPGpdTwThPjm
(source `apps/walk/index.html`).

## Why

After a week of realtime work the scene still read as a massing model. Three causes:
detail lived at the survey's scale and none at the eye's; the renderer had no true
bounce light; and every visual element carried the proof machinery of a claim (a
sourced record, a TypeScript builder, a Python mirror, a parity test). A one-day
spike rebuilt the plateau at block scale in Blender and path traced it, and it
reads as a photograph. Path tracing caps beauty only by content, and content at
block scale is something a script can generate from the data.

## What the product is

A walkthrough of **stations**. Each station is a 360-degree equirectangular panorama
rendered in Cycles, one per **state** (`today`, `built`, later `ancient` for the
lost-civilisation claim and the in-between states), with a slider that crosses
between them. Stations link to their neighbours. Flights between them, and the
rollback, are pre-rendered film. Hero **shots** are framed stills for sharing.
The claims draw on top in the browser: every station's camera is known exactly,
so lines, arcs and stars are projected over the panorama, registered to the pixel.

The realtime viewer (`apps/web`) stays as the survey and claims tool. It is no
longer the showcase and gets no further look work.

## The generator (`render/`)

A Python package that runs inside Blender 5.1 (`render/build.py` is the entry
point, the package is `render/giza/`). It reads `data/` directly with numpy and
json. No TypeScript mirror, no parity tests: the visual geometry is a
reconstruction and is labelled as one.

| Module | Builds |
|---|---|
| `data.py` | measurements, footprints, the GLO-30 grids, the city boxes, stations and shots |
| `sun.py` | sun altitude and azimuth for a moment (day of year, local solar time); bpy-free, tested |
| `noise.py` | numpy value noise and bicubic sampling |
| `nodes.py`, `materials.py` | the node-tree builder; stone, casing, granite, ground, flat materials |
| `variants.py` | weathered block, rock and person meshes, parked below the world |
| `instancing.py` | the Geometry Nodes instancer and point clouds carrying `rot`, `scl`, `var`, `tone`, `wear` |
| `pyramids.py` | the course-by-course layer, the core behind, dressed faces for `built`, Khufu's entrance and mast |
| `mastabas.py` | the 577 mastabas, laid from blocks today, dressed in `built` |
| `terrain.py` | the near grid (4 m), the far grid (60 m), the displaced patch at each camera |
| `scatter.py` | rubble at the pyramids' feet, stones round the camera, people |
| `city.py` | Open Buildings boxes for `today` |
| `sky.py` | the multiple-scattering sky, the sun lamp with its beam colour, layered haze |
| `cameras.py` | framed shots and equirectangular stations |
| `renderer.py` | Cycles on the GPU, samples, denoising, the capped adaptive subdivision |

`render/stations.json` and `render/shots.json` describe the views as data. A render
is `(state, view, moment, resolution, samples)`; `render/build.py --queue FILE`
builds each state once and renders every view in it, rebuilding only the
per-camera parts (the displaced patch and the stones).

## Rules that change

- The pyramids stay as near survey as the sources allow: base, height, slope,
  orientation, course heights, casing caps, granite bands, interior. Block sizes,
  weathering, missing blocks, rubble and sand are **look choices**, named in one
  place in the code and labelled "reconstruction at block scale" on every page.
- Nothing visual needs a record in `data/measurements/`, a TypeScript builder or a
  parity test. Numbers the claims use still do.
- Evidence tiers and the labelling of stand-ins and reconstructions are unchanged.
- Long renders go through `scripts/job.py`, as before.

## Measured costs (RTX 5070 Ti laptop)

Full-HD frame at 128 samples, about 1 minute. 4K equirectangular at 48 samples,
about 1.5 minutes. Scene build 15 to 25 seconds. Adaptive subdivision needs
`max_subdivisions` 7, `offscreen_dicing_scale` 8 and 2 px dicing or the GPU runs
out of memory building the acceleration structure.

## Order of work

1. The generator in the repo, reproducing the spike's frames.
2. The rest of the plateau: the Sphinx and its enclosure, the Sphinx and valley
   temples, Khafre's causeway and mortuary temple, enclosure walls, boat pits;
   roads for `today`; the harbour and the green valley for `built`.
3. Stations: twelve to twenty, each in `today` and `built`, golden hour first.
4. Khufu's interior from the interior survey.
5. Night stations with the star overlay drawn live from `@seked/sky`.
6. Films: flights between stations and the rollback.
