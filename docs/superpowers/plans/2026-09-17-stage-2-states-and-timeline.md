# Stage 2: states and the timeline. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the timeline mean something for every structure: the three pyramids cased and capped or stripped and stepped, the queens' pyramids, mastabas, temples, walls and causeway whole or ruined, the Sphinx in its trench per state with the claimed variants switchable, the ground buried or cleared, and the move between states a dissolve rather than a cut.

**Architecture:** Four parallel tracks on trunk commit `2026-09-17 stage 2 trunk` (see the director's brief for the hash). Track E owns the three pyramids (casing, joints, pyramidions, cores). Track F owns the lesser monuments built from `@seked/geometry`'s new builders, one component per group, replacing the OSM massings. Track G owns the Sphinx: the variant control, the trench, burial. Track H owns the transition between states, the loading line, the per-state air, and the honesty labels for procedural reconstructions. The view already carries `state`, `moment` and `sphinx`.

**Tech Stack:** as Stage 1: three 0.186, R3F 9, `@seked/geometry` builders (`pyramidionMesh`, `smallPyramidMesh`, `mastabaMesh`, `templeMesh`, `enclosureWallMesh`, `causewayRoofMesh`, `sphinxTrenchMesh`), `scene/materials` (`useStoneMaterial`, `applyStone`, `patchMaterial`, `receiveCascades`), `scene/Atmosphere.ts` (`applyAtmosphere`), `scene/Standins.tsx`.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md`, sections 2, 3 and 4.1.

## Global Constraints

Everything in Stage 1's plan holds: no em dashes; nothing typed twice (a builder with a missing key returns undefined and the scene draws nothing for it, never a guessed number; a look choice is named as one in a comment); metres and degrees; the data frame under the one rotated group; stand-ins and reconstructions labelled; commit named paths; typecheck and tests before every commit; `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; own branch in own worktree; screenshots through the browser tools in your own tab; no deploy; no `docs/progress/README.md`.

New for this stage:
- **A measurement may be added** only with a source already in `data/sources.json` and the page or plate cited in `note`, `verified: false`. The keys the builders wait for are `tier3.queens.slope` (or per pyramid), `tier3.enclosure.distance` and `tier3.enclosure.height` (or `<id>.enclosure.*`), and `sphinx.enclosure.margin`. Lehner 1997 (`lehner-1997`) and Petrie 1883 (`petrie-1883`) are the sources to read; do not enter a figure from memory.
- **A reconstruction's look choices** (wall thickness, chapel size, ruin fraction, sand level, trench margin when not a measurement) live in one `LOOK` constant per component with a comment, and the component's hover label says "reconstruction".
- **Every state-dependent component takes `state` from the store** (`useView((s) => s.state)`) and renders exactly one state; the dissolve between states is Track H's and is applied from outside through `scene/fade.ts` (see H1), so no track writes its own fade.
- **Performance:** the 577 mastabas are one merged geometry per state or an `InstancedMesh`, never 577 meshes. Rebuilding a state's geometry may take up to 100 ms; it happens once per state change and is memoised on the model and the state.

---

## Track E: the three pyramids per state

Branch `stage2/pyramids`. Owns `apps/web/src/scene/Pyramids.tsx`, `apps/web/src/scene/materials/casing.ts` (new), `apps/web/src/scene/materials/metal.ts` (new), `apps/web/src/model.ts` (pyramidion params only), `apps/web/src/view.ts` and `apps/web/src/tour.ts` and their tests (only to retire the `today` layer), `apps/web/src/store.ts` (`lookInside` only).

### Task E1: the `today` layer becomes the state

- [ ] Remove `{ id: 'today', ... }` from `LAYERS`; `Pyramids` takes `state` from the store: `stripped` and `today` draw the stepped core (with `heightToday` truncation where there are no courses) and `built` and `ancient` the cased pyramid. `lookInside` and the tour step that set `today: false` set `state: 'built'` instead (the interior reads best inside a whole pyramid). Update `view.test.ts` and `tour.test.ts`. A URL carrying `layers=...,today,...` from an old link decodes without error (unknown ids are already ignored; add a test).
- [ ] Commit: "Let the timeline, not a layer, say whether the pyramids stand cased or stripped".

### Task E2: Khafre's cap and the stripped state

- [ ] In `stripped` and `today`, Khafre keeps his cap: the cased geometry above `g2.casing.cap.lower_edge.up` (the key `render_materials.casing_cap_level` reads; find it) over the stepped core below. Build as two meshes: the core (stepped, cut at the cap level) and the cap (the cased pyramid clipped to above the level with a local clipping plane or by a truncated cased geometry from `pyramidGeometry` with `truncateAt` and a bottom cut; the geometry module may need a `fromHeight` option, add it with a test).
- [ ] Commit: "Give Khafre his cap of casing in the stripped and standing states".

### Task E3: the pristine casing

- [ ] `materials/casing.ts`: `applyCasing(material, { courses: number[]; pristine: boolean })`. For `built` and `ancient`, a near-white Tura limestone (colour from `render_materials.pristine_material`'s stated colour, quoted in a comment), roughness 0.25, `clearcoat` through `MeshPhysicalMaterial` (change the pyramid's material to physical for the cased states), and course joints from the real course tops: pack the cumulative course heights into a `DataTexture` (one texel per course, R32F) and in the fragment patch draw a 2 cm dark line where the world height above the base is within half a joint width of a course top. Faint blockwise tone variation as in the core. In `ancient` the roughness drops to 0.12 and the clearcoat to 1.0 with `clearcoatRoughness` 0.05, so the sky's environment map reflects in the faces at grazing angles (the "glass" of the spec, section 3.1.1). Everything a look choice and said so.
- [ ] Screenshot the panorama look in `built` and in `ancient` at winter dusk: in `ancient` the west edges catch the sky; the joints are visible only within about 300 m.
- [ ] Commit: "Dress the cased pyramids in polished Tura limestone with their surveyed courses".

### Task E4: the pyramidions

- [ ] `model.ts`: `pyramidions: LabelledMesh[]` from `pyramidionMesh(env, id)` for each of g1, g2, g3, in `buildModel`. `Pyramids.tsx` draws them in `built` (plain casing stone) and `ancient` (electrum: `materials/metal.ts`, `MeshPhysicalMaterial` with `metalness` 1, `roughness` 0.18, colour of electrum `#e6d7a3`, a look choice) and never in `stripped` or `today`. Test in `model.test.ts`: three pyramidions with apexes at the pyramids' apexes.
- [ ] Commit: "Cap the cased pyramids with their pyramidions, electrum in the First Time".

### Task E5: the night corona (ancient only)

- [ ] A small sprite or a `Points` glow at each apex when `state === 'ancient'` and the sun is below -6 degrees (read the sun through `useSun`? No: the Scene computes it; export a tiny store of the current sun altitude from `Atmosphere.ts`'s shared uniforms, or accept the sun as a prop from `Scene`). Emissive a few percent, slow flicker from `clock`, additive, no bloom threshold games. The caption's honesty word already says "claim" in that state; add the words "apex glow: a claim" to the pyramids' hover label (Track H's `useHoverLabel`, see H3; if not merged yet, leave a `TODO`-free comment naming it and skip the label).
- [ ] Commit: "Let the apexes carry a faint corona at night in the First Time, as a claim".

---

## Track F: the lesser monuments per state

Branch `stage2/monuments`. Owns `apps/web/src/scene/Masses.tsx` (may delete), `apps/web/src/scene/Structures/**` (new: `Queens.tsx`, `Mastabas.tsx`, `Temples.tsx`, `Walls.tsx`, `Causeway.tsx`, `Pits.tsx`, `index.tsx`), `apps/web/src/model.ts` (a `structures` section: the builders' outputs per state, memoised), `data/measurements/*.json` (new records as the constraints allow), `packages/geometry/src/*` (only bug fixes in the builders, with tests).

### Task F1: the keys

- [ ] Read Lehner 1997 and Petrie 1883 for: the slope of Khufu's queens' pyramids (G1-a to c), Khafre's satellite, Menkaure's queens (G3-a to c) and Khentkawes's tomb (a mastaba-like block, not a pyramid: give it a `kind` that keeps it a prism); the distance of each pyramid's enclosure wall from its base and its height; nothing else. Petrie's section 30 covers the peribolus of the Great Pyramid (also the "basalt pavement" and "trenches"); Lehner's chapters on each complex give the queens' dimensions. Enter what the sources give as records with page numbers, `verified: false`. Where a source gives a base and a height rather than a slope, enter those and let `smallPyramidProfile` derive the slope (extend it with a test if it does not already fall back that way).
- [ ] Commit: "Enter the queens' slopes and the enclosure walls from Lehner and Petrie".

### Task F2: the structures model

- [ ] `model.ts`: `export interface Structures { queens: LabelledMesh[]; mastabas: LabelledMesh /* merged per state */; temples: Temple[]; walls: LabelledMesh[]; causewayRoof?: LabelledMesh; enclosureWalls: LabelledMesh[] }` and `structuresFor(model: Model, state: StateId): Structures`, memoised in `App.tsx`? No: memoise inside the components on `[model, state]` so `App.tsx` stays Track H's. Map the four states onto the builders' two: `ancient`, `built` are `cased`/`whole`; `stripped`, `today` are `stepped`/`ruined`/`ruined`. The mastabas: `mergeMeshes` of all 577 per state (the builder already merges within one mastaba).
- [ ] Commit: "Build the lesser monuments per state from the footprints".

### Task F3: the components

- [ ] One component per group under `Structures/`, each with `useStoneMaterial` (core for ruins, casing for cased, granite for `khafre.valley_temple` and the temples' pillars, basalt colour for `khufu.basalt_pavement`), `castShadow`, `receiveShadow`, the section planes, and the hidden-masses check from `Masses.tsx` so a stand-in still replaces its footprint. `Temples` draws walls, roof (when whole) and pillars as three meshes with three materials. `Pits` keeps the boat pits as the massings draw them (a pit is a hole; in `built` and `ancient` it is roofed with slabs at ground level, a look choice). Delete `Masses.tsx` once nothing renders through it (the Sphinx box `Massing` moves into `Structures/index.tsx` for the no-import fallback).
- [ ] Screenshot: the dawn look in `built` (cased queens, cased mastaba streets with chapels, roofed temples with colonnades, the causeway roofed, enclosure walls) and in `today` (ruins). Screenshot close on the Eastern Cemetery in both.
- [ ] Commit: "Stand the queens' pyramids, the mastabas, the temples, the walls and the causeway up in every state".

### Task F4: labels

- [ ] Each component reports its meshes to Track H's hover-label registry (H3: `registerHover(object3D, { name, tier: 'reconstruction' | 'excavated', note })`) if that module has merged; if not, expose a `userData.seked = { name, tier, note }` on each mesh, which is what H3 reads, and say so in the report.
- [ ] Commit: "Say what each reconstructed monument is when it is pointed at".

---

## Track G: the Sphinx per state, its trench, and burial

Branch `stage2/sphinx`. Owns `apps/web/src/scene/Standins.tsx`, `apps/web/src/scene/Trench.tsx` (new), `apps/web/src/scene/Sand.tsx` (new), `apps/web/src/ui/Sphinx.tsx` (new) and one mount line in `apps/web/src/ui/Rail.tsx` or the Layers drawer (coordinate: add the control at the top of the Layers drawer, whichever file renders that drawer's body), `packages/geometry/src/trench.ts` (extend with an explicit margin option, with a test), `apps/web/src/scene/Terrain.tsx` (only to cut the ground under the trench).

### Task G1: the variant control

- [ ] `Standins.tsx`: `chosen(entries, state, variant)` already handles a variant; pass `useView((s) => s.sphinx)`. `ui/Sphinx.tsx`: three radio buttons (the state's own Sphinx, a lion, Anubis) with the claim label from `SPHINX_VARIANTS`, and a line under it saying which model that is in this state (from the manifest's `name`). In `ancient` the state's own Sphinx is the black Anubis (`default_in`), so the "Anubis" radio reads "Anubis (the state's own)" there and the lion is the only claim.
- [ ] Screenshot each variant in `today` and in `built`. Commit: "Let the reader switch the Sphinx to the claimed lion or Anubis".

### Task G2: the trench

- [ ] `trench.ts`: `sphinxTrenchMesh(env, features, { groundLevel?, margin? })`; the margin from the database key when present, else the option; the label says which. Read the ARCE Sphinx map if it is available online without a login (search "ARCE Sphinx Project map Lehner 1991 plan enclosure" and Lehner's dissertation on the AERA site); if a plan with a scale bar can be had, scale the enclosure's east-west and north-south extents with `scripts/plate.py` and enter `sphinx.enclosure.margin` (`method: "scaled from plate"`, never verified). If not, the margin is a look choice of 4 m north and south and 6 m west, named as one, and the report says so.
- [ ] `Trench.tsx`: the floor and the walls with `useStoneMaterial('bedrock')` for the walls and `'sand'` for the floor, hidden when a stand-in is not showing (no Sphinx, no trench). `Terrain.tsx`: the ground grid gets a hole where the trench is: pass the trench's outline to the ground material as a clip (a second local clipping set is awkward; simpler: in `terrainGrid`'s consumer, drop the ground triangles whose centroid lies inside the outline, with a test in the geometry package if the function lands there, or set those triangles' vertices to the trench floor level so the ground itself dips, which is what the render's `cut_enclosure` does). Choose the dip: it keeps the ground one mesh.
- [ ] Screenshot the akhet look in `built`: the Sphinx in a cut with walls, the ground dipping to the floor. Commit: "Cut the Sphinx's enclosure into the plateau".

### Task G3: burial

- [ ] `Sand.tsx`: in `stripped`, a sand surface inside the trench outline at a level that leaves the Sphinx's head and neck clear (a look choice: the outline's base plus 0.7 of the OSM head height, from the `sphinx.head` footprint's height, so it follows the data), with the sand material and a soft edge (the surface a little larger than the trench and blended down by vertex alpha, or simply overlapping the ground). The temples in `stripped` are Track F's ruins; sand around them is not attempted this stage.
- [ ] The manifest's Sphinx for `stripped`: no model names that state yet. Add `stripped` to `sphinx-meshy`'s `states` in `blender/models.json` (the weathered, human-headed Sphinx buried to the neck is the documented condition) and to `sphinx-lion`'s and `sphinx-anubis`'s (the weathered claims), then rerun `pnpm web-assets` (the manifest is written from `build/web-models/index.json`, which carries the manifest entries; check whether `export_web.py` must be rerun for a `states` change, and if so run it with `--only` for those three; it takes about a minute).
- [ ] Screenshot `stripped` at the akhet look: the head above the sand. Commit: "Bury the Sphinx to the neck in the stripped state".

---

## Track H: the dissolve, the loading line, the air per state, and the hover labels

Branch `stage2/transitions`. Owns `apps/web/src/scene/fade.ts` (new), `apps/web/src/scene/Scene.tsx`, `apps/web/src/scene/Sky.tsx` and `Atmosphere.ts` (per-state look only), `apps/web/src/scene/Hover.tsx` (new), `apps/web/src/App.tsx`, `apps/web/src/ui/**` except `ui/Sphinx.tsx`, `apps/web/src/styles.css`.

### Task H1: the dissolve

- [ ] `fade.ts`: `useStateTransition(): { from: StateId | null; to: StateId; t: number }` driven by the store's `state` and `useFrame`, `t` rising 0 to 1 over 0.8 s (a look choice). `FadeScope`: a component that wraps the rotated group's children and, during a transition, sets `alphaHash = true` and `opacity = t` on every material of objects mounted after the change and `1 - t` on those mounted before, restoring `alphaHash = false, opacity = 1` at the end. Implement by tagging: each state-dependent component's meshes get `userData.stateOf = state` when created (E, F, G already render one state and their meshes are keyed on it; document the tag in the plan's brief so they set it, or set it here by walking the scene and reading `userData.seked?.state`). If tagging by others is not in place at merge time, fall back to fading the whole rotated group out and in (0.4 s each), which needs no cooperation and still reads as a dissolve.
- [ ] Screenshot two frames mid-transition. Commit: "Dissolve between the timeline's stops".

### Task H2: the loading line and the air per state

- [ ] The caption gains a third line while assets load: "loading the stone" or "loading the Sphinx", from a small store of outstanding loads that `materials/stone.ts` and `Standins.tsx` report to (add `loading: Set<string>` and `setLoading(id, on)` to the store; the two modules call it; two lines each).
- [ ] `Sky.tsx` and `Atmosphere.ts`: a per-state air: `today` a faint brown band on the eastern horizon (the Cairo haze, a look choice: warm grey tint of the sky colour within 8 degrees of the horizon on azimuths 40 to 140, blended in the sky shader or as a thin ring mesh), `ancient` clearer air (density times 0.7) and a slightly cooler sky, `stripped` and `built` as now.
- [ ] Commit: "Show what is loading, and give each state its own air".

### Task H3: hover labels for everything

- [ ] `Hover.tsx`: one raycast per pointer move (throttled to 30 Hz) against the rotated group; the first hit whose object or ancestor carries `userData.seked = { name, tier, note }` shows a label near the pointer (DOM, not a sprite: a small glass tag in the corner of the pointer, in `ui/` styles) with the name, the tier word (survey, excavated, instrumented, claimed, reconstruction, stand-in) and the note's first sentence. `Standins.tsx` already shows its own sprite label; replace it by setting `userData.seked` on the stand-in root (coordinate with Track G: G sets `userData.seked` on the stand-in root in its G1 task; you read it). `Pyramids.tsx` sets `userData.seked` for each pyramid (name from `STRUCTURE_LABELS`, tier "survey", note "built from the measurement database under the current preset"): that is E's file; ask E to add the three lines, or add them in the merge.
- [ ] Commit: "Name whatever the pointer rests on, with its evidence tier".

---

## Merge order and verification (director)

1. Merge F (touches model.ts and deletes Masses.tsx), then E (Pyramids.tsx, view.ts, tour.ts), then G (Standins, Trench, Terrain), then H (Scene, App, ui). Reconcile `userData.seked` tagging and the `today`-layer removal by hand.
2. `pnpm typecheck && pnpm test && pnpm build:web`; screenshot the four states at the dawn and panorama looks and the akhet look for the Sphinx.
3. Snapshot 0029 (the four states as a strip); deploy; update `docs/geometry-blockers.md` and the status memory.
