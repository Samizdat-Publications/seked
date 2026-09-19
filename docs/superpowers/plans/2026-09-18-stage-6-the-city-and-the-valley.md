# Stage 6: The city behind the plateau, and the valley in front of it. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `today` state stops being three pyramids on an empty desert. Giza and Cairo stand behind them out to the Nile, the cultivated valley is green in front, and the two read against each other the way the photographs do: the monument at the edge of a city that came up to meet it. Every building in it is imported with a real outline and a real height, because the data exists and there is no reason to invent a city.

**Architecture:** One new importer, one builder, one scene component, and the water and ground the valley needs. `scripts/city.ts` streams Google's Open Buildings v3 tile for Egypt, clips it to the plateau's box, samples each footprint's height out of the Open Buildings 2.5D Temporal raster, and writes a compact binary of oriented boxes rather than polygons. `@seked/geometry` grows a builder that turns those boxes into merged prisms at two or three levels of detail. `scene/City.tsx` draws them, gated to `today`, dissolving with everything else. The valley is `Water.tsx` and `Terrain.tsx`'s green mask carried east to the river.

**Tech Stack:** as stages 1 to 5. Node's `zlib.createGunzip` over `fetch` for the footprint stream, no new dependency. A GeoTIFF reader for the height raster: prefer range requests against the tile's own tiling over downloading 1.2 GB, and if that needs a library, `geotiff` (MIT) is the one to add, with the fallback of a one-time download behind `scripts/job.py`.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md` for the look. CLAUDE.md's "The modern city is context, not evidence" rule is the contract for this whole stage: no evidence tier, no claim may cite it, and nothing in it invented.

## Evidence (director, 2026-09-18, measured before any of this was planned)

**OSM is the wrong source and was nearly used.** Overpass was asked what is actually in the ground. In the importer's present bbox, 989 buildings; widened to the canal, 1,410; widened to the Nile, a 9.4 by 11.1 km box, 7,274. Of those 7,274, fifteen carry a `height` and 122 a `building:levels`, so **98 per cent have no height of any kind**, and nearly a quarter of them sit in one square kilometre around 29.99, 31.21, five to eight kilometres east of the plateau. Extruded, that is a few well-mapped districts on an empty plain with every height invented.

**Google Open Buildings v3, footprints.** The S2 level-4 tile containing Giza is `145`, 1,315 MB gzipped, at `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/145_buildings.csv.gz`. Header `latitude,longitude,area_in_meters,confidence,geometry,full_plus_code`, geometry as WKT. It is **not** spatially sorted, so it is streamed whole; streaming and clipping 13,308,407 rows to the box `29.940, 31.100, 30.040, 31.240` took **48 seconds** and kept **277,266 buildings**, mean footprint 143 m2, 39.6 km2 of roof. By confidence: 45,277 below 0.70, 185,491 between 0.70 and 0.85, 46,498 at 0.85 or above. That is thirty-eight times what OSM has.

**Google Open Buildings 2.5D Temporal, heights.** Public, listable, no Earth Engine account. The manifest `v1/manifests/15_EPSG_32636_2023_06_30.json` (UTM 36N, which is Giza's zone) lists 6,035 tiles, of which **exactly one contains Giza**: `v1/geotiffs/14584_2023_06_30/tile_ZEIX66sm0PA.tif`, origin 319912, 3321468 in UTM 36N, 25000 by 25000 px at 0.5 m, a 12.5 km square, 1,169 MB, bands `building_fractional_count`, `building_height`, `building_presence`. It serves range requests (206). Giza's own UTM position is 319994, 3317945, which is 82 m east and 3.5 km south of that tile's north-west corner, **so the tile does not reach the north of the box and one or two neighbours are needed**; find them from the same manifest rather than guessing. Stated accuracy is a mean absolute error of 1.5 m, and heights are capped at 100 m. The height band is only meaningful where the presence band agrees.

**Both licences are CC BY 4.0 or ODbL**, the licence holder's choice, and the project already carries ODbL attribution for OSM.

## Global Constraints

Everything in the stage 1 to 5 plans holds: no em dashes; nothing typed twice; metres and degrees; the data frame under the one rotated group; commit named paths; `pnpm typecheck` and `pnpm test` before every commit; `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; own branch in own worktree under `.claude/worktrees/`; screenshots at 1600 by 900 in a browser nobody else has the address of (`scripts/frames.md`); no deploy. Claim the repo with `python scripts/job.py claim <session>` before the trunk.

New for this stage:

- **The city is context and says so.** No structure in it gets an evidence tier, no claim may cite it, and its hover tag names Google Open Buildings and the year of the imagery. It is drawn only in `today`. A reader must never be able to mistake it for survey.
- **A height is a measurement with an error bar, not a look choice.** Every building's height comes from the 2.5D raster and the import records the raster's stated 1.5 m mean absolute error in the file's header, the way `data/footprints/giza.json` records its registration residuals. A building the raster cannot give a height for is either drawn at a stated look-choice height or left out, and the import says which and how many.
- **Nothing about the city is typed.** The importer writes the file; nobody edits it. `data/sources.json` gains both datasets with their URLs, their sizes, their checksums and the attribution their licences require.
- **The big files are gitignored**, like the HYG CSV: the 1,315 MB footprint archive and the 1,169 MB raster tile are caches, and what is committed is the clipped result.
- **The clipped result is small or it is not committed.** 277,266 polygons as JSON is not a data file, it is a liability. Store an oriented box per building (centre, width, depth, yaw, height) in a binary, the way `giza-glo30.f32` already does for the terrain, and say in the header that the outline is the best-fit box of the imported polygon and not the polygon itself. A city seen from a kilometre away is boxes; if a later stage wants real roof outlines near the camera it can add them for a few hundred buildings.
- **A frame rate is a number in a commit message,** as in stage 5, taken the way `scripts/frames.md` says. The `today` state ran 237 to 240 fps before this stage; the bar is that it still clears 100 with the city in.

---

## The trunk (director, before the tracks branch)

- [x] `data/sources.json`: add `open-buildings-v3` and `open-buildings-25d-temporal`, each with its URL, licence (CC BY 4.0 or ODbL), the attribution the licence requires, and a note that the raw archives are cached outside the repo.
- [x] `.gitignore`: the footprint archive and the raster tiles under `build/city/`.
- [x] `data/structures.json` or its loader: a way to mark a group `context`, carrying no evidence tier, so `City.tsx` and the hover tag can read one flag rather than special-casing a name. Tests that a context group is refused an evidence tier and that no claim may reference one.
- [x] Commit: "Give the city somewhere to be context rather than evidence".

---

## Track V: the importer

Branch `stage6/import`. Owns `scripts/city.ts`, its test, and `data/footprints/city.*`.

### Task V1: the footprints, streamed and clipped

- [x] `scripts/city.ts` streams tile 145 through `createGunzip`, parses each line by index rather than a CSV library (the first two fields are unquoted numbers, the geometry is quoted and last but one), and keeps rows inside the box. Reuse `footprints.ts`'s endpoint-retry shape and its cache-file convention. A `--refresh` flag re-fetches; without it a cached clip is reused.
- [x] Each kept building is reduced to its oriented bounding box: the minimum-area rectangle of its WKT polygon, as centre, width, depth and yaw. Tested against a handful of hand-checked polygons, including one long thin building and one near-square, so a wrong yaw cannot pass.
- [x] A confidence floor is a look choice with a sentence: below it a building is not drawn. Start at 0.70, which leaves about 232,000 of the 277,266.
- [x] Commit: "Take the city's outlines from Open Buildings, streamed and clipped to the plateau's box".

### Task V2: the heights

- [x] Find every 2.5D tile the box needs from the manifest, by extent, never by guessing a name. Read `building_height` at each building's centre, with `building_presence` as the gate the dataset asks for.
- [x] Prefer range requests into the GeoTIFF's own tiling over a 1.2 GB download per tile. If that needs `geotiff`, add it and say so; if a whole-tile download is the honest simpler answer, run it under `python scripts/job.py start` and say that instead.
- [x] Record, in the output header: how many buildings got a height, how many did not, what was done with those, the raster's 1.5 m mean absolute error, the imagery year, and the 100 m cap.
- [x] Commit: "Give each building the height the 2.5D raster measured, and say what the error is".

### Task V3: the file

- [x] Write `data/footprints/city.bin` (oriented boxes, little-endian float32, a fixed record) plus `data/footprints/city.json` carrying only the header: the sources, the box, the counts, the confidence floor, the error bars, the checksums of both archives. Both committed; neither hand-edited. Target well under 10 MB.
- [x] `scripts/bundle.ts` copies it the way the terrain is copied. `@seked/data` was deliberately left alone: the city is context rather than database, the two files are copied whole into `apps/web/public/city/` and fetched there, and a loader in `packages/data` would have been track V editing a file tracks W and X also want. `city.json` describes its own binary, including the record names, the stride and the sha256, so a reader needs nothing from `@seked/data` to read it.
- [x] Commit: "Write the city as boxes and a header, and nothing a person would edit".

---

## Track W: the geometry

Branch `stage6/geometry`. Owns the new builder in `packages/geometry` and its tests.

### Task W1: boxes to prisms

- [x] `cityMeshes(boxes, opts)` builds merged prisms, batched into a small number of meshes by region so the far half can be culled as a unit. Two or three levels: full boxes near, and beyond some distance a coarser pass where small buildings are dropped or merged into blocks rather than drawn individually. The distances are look choices with sentences.
- [x] Tests: vertex counts, that a box's prism stands on the terrain height under it, that the yaw is applied about the box's own centre.
- [x] Commit: "Build the city as merged prisms, in bands that can be culled together".

---

## Track X: the city in the scene

Branch `stage6/scene`. Owns `apps/web/src/scene/City.tsx` and one section at the end of `styles.css`.

### Task X1: drawn, gated and labelled

- [x] `City.tsx` draws the meshes in `today` only, dissolving with stage 2's fade, clipped by the section like everything else, its hover tag naming Open Buildings and the imagery year and the word `context`.
- [x] A Layers drawer toggle, because a reader looking at the plateau may want the city gone.
- [x] Verify: the frame rate at the five looks in `today`, before and after, in the commit message. The bar is 100 fps.
- [x] Commit: "Stand the city behind the plateau in the state it belongs to".

---

## Track Y: the valley

Branch `stage6/valley`. Owns the valley's part of `Water.tsx` and `Terrain.tsx`'s green mask.

### Task Y1: the Nile and the cultivation

- [x] The river east at its present course and the cultivated strip between it and the desert edge, green in `today` and `stripped`, in the same terms stage 3 used for the flood plain rather than a second mechanism. Where the desert gives way to cultivation is a look choice and says so.
- [x] Verify at `panorama` and the today hero stand, with a screenshot each.
- [x] Commit: "Put the river and the green strip back in the valley".

---

## Merge order and verification (director)

1. V first, because W, X and Y are all downstream of the file it writes. Then W, X, Y.
2. Typecheck, test, build. The frame rate at the five looks in `today`, against the 237 to 240 of stage 5.
3. A today hero still from the panorama stand with the city behind and the valley green, against snapshot 0028's same stand, which is the before.
4. Snapshot 0033; deploy; the blockers doc's order of work gains stage 6; memory updated; the boxes ticked.

---

## What was run (director, 2026-09-18)

Tracks V, W, X and Y all landed on `main`, in that order, each on its own
branch and merged with `--no-ff`.

**One thing was added that this plan does not have, and it came before the
tracks.** The ground stopped at three kilometres and the city runs to ten, so
W had nothing to stand a prism on and X and Y had nothing to draw on.
`terrainRing` in `@seked/geometry` draws `data/terrain/giza-glo30-far`, the
same Copernicus product over plus or minus twelve kilometres at sixty metres,
with the fine grid's square left out and its edge carried on as a flat skirt
to thirty-five kilometres so the world does not end short of the horizon. It
is committed as "Give the city, the valley and the horizon a ground to stand
on" and merged as `stage6/ground`.

**Track V's own correction stands**: no loader went into `packages/data`, and
`city.json` describes its own binary, so `@seked/geometry` and `City.tsx` read
it without one.

**What was measured.** `today` at a 1601 by 900 buffer, three takes of two
seconds, median, the way `scripts/frames.md` says. After track X, with the
city then without it: dawn 189 / 201, panorama 185 / 205, harbour 177 / 178,
akhet 189 / 189, night 200 / 209, against a bar of 100. After track Y, with
the city, the river and the valley's green: dawn 192, panorama 188, harbour
115, akhet 137, night 97.

**So the city is nearly free and the green is not.** The river was ruled out
by hiding it, which made the night stand *faster* (96 with it, 81 without),
because the water's own depth write hides the city behind it. What is left is
the green: in the two modern stops `greenFor` now gives a non-zero strength,
so the shader that used to return at its first line on every ground fragment
now runs in full over the plateau's grid and the desert ring both, and the
night stand is where the ground fills the most of the frame. One stand of the
five is three per cent under the bar.

**Not measured, and it should be:** `built` and `ancient` after track Y. The
desert ring takes the green in those stops too. No number could be taken for
them, because this environment cannot hold a browser window in the foreground
and Chrome throttles an occluded one to about one frame a second; the runs
that were taken are the ones whose windows happened to be in front, and the
throttled ones are obvious when they come back as 1.

**The first thing for the next pass**, therefore: the green's per-fragment
cost in the modern stops, with `built` and `ancient` measured alongside. The
obvious lead is that the valley's `upland` is zero, so its mottle is dead
arithmetic, and a fragment whose ground stands more than `dryMetres` above
the water is provably zero before the mask is ever sampled. Neither was
changed here, because an optimisation that cannot be measured is not one.

**Found on the way and not fixed**, because it predates this stage: east of
the plateau with a low sun the ground reads near black (17, 33, 47 at the
panorama stand at 16:00 in `today`). It is not a hole and not a shader patch,
both ruled out by substituting plain materials and by removing each patch in
turn, and the same pixels are 116, 146, 160 at midsummer noon. It is ground
in shade lit by too little else, and it wants its own look at the ambient
term.
