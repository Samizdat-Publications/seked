# Licences

Seked is released under two licences, plus the licences of the data it imports.

## Code: MIT

Everything that is software (`packages/`, `apps/`, `scripts/`, `render/`, `blender/` and the build
and test configuration) is under the MIT licence in [`LICENSE`](LICENSE).

## The project's own content: CC BY 4.0

The renders, panoramas, films and images the project makes, the guided tour's text
(`apps/walk/tour.json`), the pages' prose and the documents in `docs/` are licensed under the
[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).
Credit them as "Seked (seked.pages.dev)", with a link where you can.

## Imported data keeps its own licence

These are not relicensed by the above; their terms travel with them and with what is derived from them.

| What | Where | Licence |
|---|---|---|
| HYG 4.2 star catalogue (David Nash, astronexus) | `data/stars/` | CC BY-SA 4.0 |
| Constellation figure lines (Stellarium's modern sky culture) | `render/giza/alignments/lines.json` | CC BY-SA 4.0 |
| Monument footprints, © OpenStreetMap contributors | `data/footprints/giza.json` | ODbL 1.0 |
| City footprints and heights (Google Open Buildings v3, 2.5D Temporal) | `data/footprints/city.*` | CC BY 4.0 |
| Terrain (Copernicus GLO-30 DEM) | `data/terrain/` | Copernicus DEM licence |
| Skies and textures (Poly Haven) | fetched by `scripts/skies.py`, `scripts/textures.py` | CC0 |
| Stand-in 3D models | listed with their own licences in `blender/models.json` | as listed |

Survey figures in `data/measurements/` are facts taken from the published sources cited in
`data/sources.json`, each with its source.
