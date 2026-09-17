# Stage 3: The First Time. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the oldest state beautiful and alive, and the others better for it: water in the harbour and the valley, the Green Sahara on the plateau's margins, a second pass on light and air that fixes what stages 1 and 2 showed (dark sunsets, heavy aerial haze, cool polished faces), real sculpture from museum scans in the temples, and the temple and enclosure forms read from published plans.

**Architecture:** Four parallel tracks on main at the commit the director names. Track I owns water, the ground's colour by state and the vegetation. Track J owns the sky, the air, the environment light and the renderer's exposure. Track K owns a props pipeline (downloaded models placed by explicit anchors rather than fitted to footprints) and the sculpture, ship and palms that go through it. Track L owns the plans: the ARCE Sphinx map for the trench, Hölscher for Khafre's valley temple, Reisner for Menkaure's, entered as scaled or transcribed records and built by the temple builder.

**Tech Stack:** as stages 1 and 2, plus drei's `MeshReflectorMaterial` (already installed with drei 10) for water, `@gltf-transform/functions` `simplify` for scan decimation, `scripts/plate.py` for plans, the Sketchfab and Poly Haven APIs already used by `scripts/models.py` and `scripts/textures.py`.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md`, section 3.1 above all, and 4.2.

## Global Constraints

Everything in the stage 1 and 2 plans holds. In addition:

- **The First Time is a claim and says so.** Vegetation density, water extent beyond the harbour, the statues' placement and the guardians are staging for that claim; each carries `userData.seked` with tier `claim` (ancient-only things) or `reconstruction` (built-state things with a mainstream source), and its note names the source or the look choice.
- **Science is not a claim.** The African Humid Period (about 12,500 to 3,500 BCE) is the reason the ancient state is green; cite it in the About drawer's text (Track I writes the sentence, the director places it) and in the vegetation's note.
- **Placements are one file.** Anything downloaded and placed by hand lives in `blender/props.json` with its source, licence, attribution, a `placements` list in the data frame (east, north, up or `ground`, yaw degrees, scale) per state, and `evidence`. Nothing about a prop's placement is a measurement unless it cites a plan and says which.
- **Scans are decimated, never resculpted.** A museum scan goes through gltf-transform `simplify` to LODs and keeps its own textures; nothing changes its form.
- **Fetching a public file with a script** (an archive.org PDF, an Open Context image, a Sketchfab GLB, a Poly Haven model) is what `scripts/textures.py`, `models.py` and `plate.py` already do and is allowed; record every URL, sha256 and licence in the manifest or the source record.
- Reading a plan follows CLAUDE.md's rule exactly: a printed dimension is transcribed and cites the plate; a distance scaled against the plate's scale bar is `method: "scaled from plate"` with the three-term sigma, never verified.

---

## Track I: water and the Green Sahara

Branch `stage3/green`. Owns `apps/web/src/scene/Water.tsx` (new), `apps/web/src/scene/Vegetation.tsx` (new), `apps/web/src/scene/Terrain.tsx` (the ground's colour by state), `apps/web/src/scene/materials/ground.ts` (new, if the sand material's state logic wants its own file), `packages/geometry/src/water.ts` (new) and its test, `apps/web/src/scene/Scene.tsx` only to mount `<Water />` and `<Vegetation />` inside the fade scope (two lines; report them).

### Task I1: where the water is

- [ ] `packages/geometry/src/water.ts`: `waterLevel(env, state)` and `waterExtent(features, env, state)`. The harbour of `built` is a basin east of the two valley temples: its floor level is the valley temples' base level from their footprints (`footprintSpan`) less 2 m (a look choice, named), and its outline a rectangle from the temples' east faces out 250 m east and spanning both temples plus 60 m north and south (look choices; Lehner's harbour lies there, cited as the reason in the label). In `ancient` the water is the flood plain: every ground sample below the same level east of the plateau's edge, which `Water.tsx` draws as one plane at that level clipped by the terrain (the terrain hides it where the ground is higher). `stripped` and `today` have no water. Tests: level is undefined without the temples' footprints; the basin outline contains both temples' east faces.
- [ ] Commit: "Say where the water stood, from the valley temples' floor".

### Task I2: the water

- [ ] `Water.tsx`: one plane per state that has water, drei `MeshReflectorMaterial` (mirror 0.6, blur, mix strength, a procedural normal from two scrolling noise textures made on a canvas, colour a deep Nile green-blue, all look choices), at the level from I1, clipped by the basin outline in `built` (a shape geometry) and the whole east in `ancient`. It receives the air (`applyAtmosphere`) and the cascades. Cost: the reflection renders the scene once more at half resolution; gate it on `quality` from the renderer if that prop exists, else always on.
- [ ] Screenshot the harbour look in `built` and in `ancient` at winter dusk: the temples and the Sphinx reflected.
- [ ] Commit: "Fill the harbour and the flood plain".

### Task I3: the ground by state

- [ ] The sand material takes a `state`: in `ancient`, a green-grey grass tint blended in by a mask (low elevation near the water strongly, higher ground by a large noise, none on steep bedrock or within 15 m of a monument's footprint, all look choices), in `built` a faint scrub mottle, in `stripped` and `today` the current sand. The mask is computed in the shader from world height and a noise, with the water level and a per-state strength as uniforms, so no geometry changes.
- [ ] Commit: "Green the plateau's margins in the First Time".

### Task I4: grass and scrub

- [ ] `Vegetation.tsx`: an `InstancedMesh` of crossed quads (grass cards) with a grass texture drawn on a canvas (alpha-tested blades in three greens), instanced by the same mask as I3 evaluated on the CPU over the terrain grid (density per square metre a look choice; cap the count at 60,000; fade by distance in the vertex shader). Shrubs from Poly Haven (`shrub_01`, `wild_rooibos_bush`) and trees (`island_tree_01`) come through Track K's props manifest as `kind: 'plant'` entries with no placements; `Vegetation.tsx` reads the manifest and scatters them by the mask with per-kind densities. If the props manifest is not present at merge, the cards ship alone and the scatter code waits for it.
- [ ] Screenshot the dawn look in `ancient`: grass on the margins, the pyramids untouched, the desert beyond savanna-coloured.
- [ ] Commit: "Grow grass, scrub and trees where the First Time was wet".

---

## Track J: light and air, second pass

Branch `stage3/light`. Owns `apps/web/src/scene/Sky.tsx`, `apps/web/src/scene/Atmosphere.ts`, `apps/web/src/scene/Renderer.tsx`, `apps/web/src/scene/materials/casing.ts` and `metal.ts` (the environment's warmth only), `apps/web/src/looks.ts` (moments only).

### Task J1: the sun near the horizon

- [ ] The akhet look (June solstice, 19:00) renders nearly black. Rework `skyLook`'s anchors from -6 to +10 degrees: the sun's intensity should be about a fifth of noon at 2 degrees and go out only below -1, its colour deep orange; the fill from the sky should not fall below 0.15 while the sky is bright; the exposure (renderer `toneMappingExposure`, now fixed) becomes a table by altitude too, brighter at dusk and dawn. Check against docs/progress/0015-blender-akhet-causeway.png and 0007-blender-akhet.png: the sun in the notch between Khufu and Khafre, the plateau warm and legible.
- [ ] Commit: "Keep the plateau legible with the sun on the horizon".

### Task J2: the air by distance and height

- [ ] The aerial perspective washes the foreground at aerial stands (a camera 260 m up over the Eastern Cemetery loses its contrast within 500 m) while it reads right at the panorama's 1.7 km. Reduce `density` and `lowSunDensity` by about a third, lower `scaleHeight` to 500 m so height buys clarity faster, and add the render's low dust layer: a second exponential term in the first 40 m above the ground with its own density, strong at dawn and dusk and gone at noon (look choices). Compare the aerial stand of snapshot 0029 and the panorama before and after; both should improve.
- [ ] Commit: "Thin the air overhead and pool the dust low".

### Task J3: a warm ground in the environment

- [ ] The environment map is the sky alone, so metals and clearcoats reflect blue from below and the electrum went to soot at dusk. Put the ground in it: in the PMREM scene, a hemisphere or a large disc under the sky mesh coloured as the sand lit by the current sun (the sand colour times the sun colour times a cosine of the sun's altitude, plus the sky's fill), so the lower half of every reflection is warm. Then revisit `casing.ts`'s `ancient` polish and `metal.ts` with the director's retune as the starting point (roughness 0.2, clearcoat 0.45; electrum roughness 0.3, metalness 0.85, environment 2.5) and set the values that make the polished faces read cream with a sheen and the caps read gold at winter dusk from the panorama stand.
- [ ] Commit: "Give reflections a ground to stand on".

### Task J4: the night

- [ ] With the sun down the plateau is black. Add starlight and skyglow: a faint blue hemisphere from the star dome's own mean brightness, and in the First Time a hint of the apexes' corona on the casing below them (a point light at each apex, low, warm-white, ancient only, off in every other state). Moonlight is out of scope (no moon in the sky package).
- [ ] Commit: "Light the night by the stars, and by the caps in the First Time".

---

## Track K: props, sculpture, the ship and the palms

Branch `stage3/props`. Owns `blender/props.json` (new), `scripts/props.py` (new), `scripts/web-assets.ts` (a props pass), `apps/web/src/scene/Props.tsx` (new), `apps/web/src/scene/Scene.tsx` only to mount `<Props />` inside the fade scope (one line; report it), `.gitignore` (`apps/web/public/props/`).

### Task K1: the props pipeline

- [ ] `blender/props.json`: `{ about, props: [{ id, kind: 'statue' | 'guardian' | 'ship' | 'plant' | 'rock', name, source: { sketchfab: uid } | { polyhaven: id }, license, attribution, url, evidence, front: '+y', ground_z, scale_to?: { height_m } | { length_m }, placements: { <state>: [{ east, north, up | 'ground', yaw, scale? }] }, note }]`. `scripts/props.py` downloads each into `build/props/<id>/model.glb` (Sketchfab through the same token and download endpoint as `models.py`; Poly Haven through `https://api.polyhaven.com/files/<id>` picking the 2k glTF), pins sha256 into the manifest. `web-assets.ts` gains a props pass: `simplify` to three LODs (100 percent, 25 percent, 6 percent of the source faces, error 0.001), textures to 1024 WebP, meshopt, into `apps/web/public/props/<id>.glb` and `props/manifest.json` carrying every field plus bytes, sha256, lods. The pipeline does not fit anything; a prop is placed where the manifest says.
- [ ] Commit: "Add a props pipeline for models placed by hand".

### Task K2: the sculpture

- [ ] Fetch the seated Khafre (`135dc9f9c7d0426087f781cdd24019f6`, pmanuelian, CC BY; fall back to `071b25978c054c73bd179f89c33a5ffe`), the recumbent jackal (`a2c4b91186874cdcbd1ecd80c821c9e0`, camcolab; fall back to `f75756aa97704f2784c97bb7c00b2ac3`), Khufu's solar ship (`5c56a4feeb8e4c67b5a4d903b4a96e5a`, juanbrualla), the date palm (`11acf710e6c149daa8d6fb8cdc5d087f`, evolveduk), and Poly Haven `shrub_01`, `wild_rooibos_bush`, `island_tree_01`, `boulder_01`. Look at each in the browser once compressed and drop any that is poor (say which). `scale_to`: the seated Khafre to 1.68 m (the diorite statue's height, Cairo JE 10062, cite it in the note as the object's own size, not a Giza measurement); the jackal to 2.5 m long as a guardian (a look choice); the ship to 43.6 m (the Khufu ship's own length, cite it); the palm to 12 m.
- [ ] Placements: the seated king at the 23 statue emplacements of Khafre's valley temple if Track L has entered them (`khafre_valley_temple.statue.<n>.*` keys; read `data/measurements` at merge), else on a grid inside the temple's footprint in `built` and `ancient` (a look choice, replaced when L lands); the jackal pair flanking each temple's east door in `ancient` only, tier `claim`; the ship in the northern boat pit east of Khufu in `ancient` (the pit open, the ship on the water of Track I if the level reaches it, else on the pit floor) and nowhere else; palms as `kind: 'plant'` with no placements (Track I scatters them).
- [ ] `Props.tsx`: loads the manifest, instances each prop's placements for the store's state (one `InstancedMesh` per LOD per prop, LOD by distance), casts and receives shadows, `applyAtmosphere`, `userData.seked` on the group with the manifest's name, tier and note.
- [ ] Screenshot the valley temple's hall in `built` with the kings in it (Track L's hall if merged, else the colonnade), the ancient temple door with its jackals, the ship in its pit.
- [ ] Commit: "Seat the king in his temple, set the jackals at the doors, and float the ship".

---

## Track L: the plans

Branch `stage3/plans`. Owns `data/measurements/sphinx-enclosure.json` (new), `data/measurements/khafre-valley-temple.json` (new or extended; check what `nell-ruggles-2014` already gives under `khafre_valley_temple.*`), `data/sources.json` (new sources), `packages/geometry/src/trench.ts` (per-side margins) and `temple.ts` (a plan-driven temple: `templePlanMesh`), their tests, `apps/web/src/scene/Structures/Temples.tsx` (to draw the plan-driven hall where one exists), `build/plates/` (gitignored scans).

### Task L1: the Sphinx enclosure from the ARCE plan

- [ ] Open Context project `141e814a-ba2d-4560-879f-80f1afb019e9` (the ARCE Sphinx Mapping Digital Database, CC BY 4.0): find through its JSON API (`https://opencontext.org/projects/<uuid>.json`, then the media records) the 1:200 topographic map or the 1:50 master plan with a scale bar, download the full-size image to `build/plates/`, record the source in `data/sources.json` (`arce-sphinx-mapping-oc`, URL, licence, the media record's own citation). With `scripts/plate.py`, `scale` from its bar and `measure` the enclosure floor's extent north, south and west of the Sphinx's body outline, and the floor level if the map states it. Enter `sphinx.enclosure.margin.north`, `.south`, `.west` (and `.east` if the plan closes it) as `scaled from plate` with sigmas. `trench.ts` takes per-side margins from those keys, falling back to the uniform option; `Trench.tsx` (Track G's, read only) needs no change if the builder reads the keys; if it does, make the smallest change and report it.
- [ ] Commit: "Cut the Sphinx's enclosure to the ARCE plan".

### Task L2: Khafre's valley temple from Hölscher

- [ ] Hölscher, *Das Grabdenkmal des Königs Chephren* (1912), is public domain and on archive.org (find the item; the plan of the valley temple is a fold-out plate with a scale). Add the source. Transcribe what is printed (the hall's overall dimensions, the pillar spacing if given) and scale the rest: the T-shaped pillared hall's outline, the sixteen pillar positions, the twenty-three statue emplacements along its walls, the two entrances on the east, the passage to the causeway. Enter them as `khafre_valley_temple.hall.*`, `khafre_valley_temple.pillar.<n>.east/north`, `khafre_valley_temple.statue.<n>.east/north` relative to the temple's own footprint centroid and axis (say which corner or axis the plate is registered on; `plate.py register` onto the OSM outline's corners is the way).
- [ ] `temple.ts`: `templePlanMesh(f, env, plan, state)` builds walls from a plan's rooms (a list of rings), pillars from positions, and the roof, granite-clad inside (a material tag per mesh). `Temples.tsx` draws the plan-driven temple where the database has a plan for that footprint and the generic one elsewhere. Tests: pillars inside the hall, the hall inside the footprint.
- [ ] Screenshot the hall from inside in `built`, looking west from the east door. Commit: "Build Khafre's valley temple from Hölscher's plan".

### Task L3: Menkaure's temples from Reisner (if time allows)

- [ ] Reisner, *Mycerinus* (free PDF linked in docs/geometry-blockers.md), plans of the mortuary and valley temples: the same treatment for the court and the inner rooms, as far as one evening allows. Commit: "Build Menkaure's temples from Reisner's plans".

---

## Merge order and verification (director)

1. Merge K (props pipeline), then L (plans and records), then J (light), then I (water and green, which reads K's manifest). Resolve Scene.tsx mounts by hand.
2. Regenerate assets: `python scripts/props.py`, `pnpm web-assets`; typecheck, test, build.
3. Screenshot The First Time at dawn, at winter dusk and at midnight from the panorama and harbour stands; snapshot 0030; deploy; update the docs and memory.
