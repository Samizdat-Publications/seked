# Stage 1: Light, air, stone, and the shell. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web viewer look like the Blender renders (sun, sky, air, stone, shadows, post), give it the new cinematic interface shell, prove the Blender-to-web asset pipeline on today's Sphinx, and land the geometry builders Stage 2 will stand the plateau up with.

**Architecture:** Four parallel tracks on one trunk commit. Track A (look) owns the scene's renderer, sky, atmosphere and materials. Track B (builders) owns new pure builders in `@seked/geometry` with tests and no scene wiring. Track C (shell) owns the React panels, styles and the app layout. Track D (assets) owns the Blender export, the gltf-transform step and the stand-in loader. The trunk adds the shared view state (`state`, `moment`), the dependencies, and a `Standins` mount point so no two tracks edit the same file.

**Tech Stack:** three 0.186, React Three Fiber 9, drei 10, `postprocessing` + `@react-three/postprocessing`, three's `csm` and `Sky` examples, `@gltf-transform/core|extensions|functions|cli`, Blender 5.1.2 headless (`"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"`), Python 3.14 stdlib, vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md`

## Global Constraints

- No em dashes anywhere (code, comments, docs, commit messages). Use a comma, colon, period or spaced hyphen.
- Nothing typed twice: any number the scene needs comes from `data/measurements` through the environment, or from the sky package. Look choices (fog density, bloom strength, tints) are allowed and are named as look choices in a comment.
- Units are metres and degrees. The data frame is +X east, +Y north, +Z up; three's world is that frame turned Y-up by the one `group rotation={[-Math.PI/2,0,0]}` in `Scene.tsx`. A camera in the store is in the world frame: `[east, up, -north]`.
- Stand-ins are labelled. A GLB drawn in the viewer carries its manifest attribution and evidence tier into a hover label.
- `verified: false` and evidence tiers are never changed by this stage.
- Commit named paths only, never `git add -A`. Run `pnpm typecheck` and `pnpm test` before every commit. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (an agent on Opus writes its own model name there).
- Each track works on its own branch in its own worktree and touches only the files its task lists, plus new files under the directories it owns. The trunk is `main` at the commit named in the task brief.
- Every file the viewer serves stays under 20 MB (Cloudflare Pages refuses 25 MiB).
- Visual work is verified by screenshot in the browser at 1600 by 900 with `pnpm --filter @seked/web dev` (or `vite preview` after a build). An agent opens its own tab with `tabs_create` and passes that `tabId` to every browser call; it never closes another tab.

---

## Task 0 (trunk, done by the director before the tracks start): shared state and dependencies

**Files:**
- Modify: `apps/web/src/view.ts`
- Modify: `apps/web/src/store.ts`
- Modify: `apps/web/src/view.test.ts`
- Create: `apps/web/src/scene/Standins.tsx` (a stub that renders null)
- Modify: `apps/web/src/scene/Scene.tsx` (mount `<Standins />` inside the rotated group)
- Modify: `apps/web/package.json`, `package.json`, `pnpm-lock.yaml`

**Interfaces produced:**

```ts
// view.ts
export const STATES = [
  { id: 'ancient', label: 'The First Time', kind: 'claim', epoch: -10499 },
  { id: 'built', label: 'As built', kind: 'reconstruction', epoch: -2449 },
  { id: 'stripped', label: 'Stripped and buried', kind: 'reconstruction', epoch: 1500 },
  { id: 'today', label: 'As it stands', kind: 'survey', epoch: 2026 },
] as const;
export type StateId = (typeof STATES)[number]['id'];
/** Day of the year (1 to 366) and local mean solar time in hours (0 to 24). */
export interface Moment { day: number; hour: number }
export const MOMENTS: ReadonlyArray<{ id: string; label: string; moment: Moment }>;  // equinox-dawn, winter-dusk, summer-sunset, midnight
export interface View { ...existing; state: StateId; moment: Moment }
// URL: state=<id>; moment=<day>,<hour>  (hour to two decimals)
// DEFAULT_VIEW.state = 'today'; DEFAULT_VIEW.moment = MOMENTS winter-dusk (day 355, hour 15.5)
// store.ts
setState(state: StateId): void;   // also sets epoch to that state's default epoch when the reader has no override
setMoment(moment: Partial<Moment>): void;
```

Dependencies added to `apps/web`: `postprocessing`, `@react-three/postprocessing`. Dev dependencies at the root: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `@gltf-transform/cli`, `sharp`, `meshoptimizer`.

---

## Track A: light, air, stone

Owner: one agent. Branch `stage1/look`. Owns `apps/web/src/scene/Scene.tsx`, `apps/web/src/scene/Renderer.tsx`, `apps/web/src/scene/Sky.tsx`, `apps/web/src/scene/Atmosphere.ts`, `apps/web/src/scene/materials/**`, `apps/web/src/scene/Pyramids.tsx`, `apps/web/src/scene/Terrain.tsx`, `apps/web/src/scene/SkyDome.tsx`, `apps/web/src/sky.ts`, `apps/web/src/scene/stone.ts` (may delete into materials/), `scripts/web-textures.py`, `packages/sky/src/sunpath.ts` (new) and its test.

### Task A1: the sun for any moment

**Files:**
- Create: `packages/sky/src/sunpath.ts`
- Create: `packages/sky/src/sunpath.test.ts`
- Modify: `packages/sky/src/index.ts`, `packages/sky/src/browser.ts` (export it)

**Interfaces:**
- Consumes: `solarDeclinationAndRa(jde)`, `equationOfTime(jde)` from `solar.ts`; `altAz` from `horizon.ts`; `obliquityOfDate` from `sun.ts`; the Julian day helpers in `calendar.ts`.
- Produces:

```ts
export interface SunPosition { azimuthDeg: number; altitudeDeg: number; apparentAltitudeDeg: number | undefined; jde: number }
/** The sun over an observer at a Julian epoch, on a day of that year, at local mean solar time in hours. */
export function sunAt(opts: { epoch: number; day: number; hour: number; latitudeDeg: number; longitudeDeg: number }): SunPosition;
```

- [ ] **Step 1: Write the failing test.** The bake in `build/sky-bake.json` is the oracle: for the observer in its header, `sunAt` at the March equinox of the bake's epoch, one hour after sunrise, must land within 0.3 degrees of moment `equinox-sunrise-plus-hour` (azimuth 97.12, altitude 12.13), and at the December solstice an hour before sunset within 0.3 degrees of `solstice-winter-sunset-minus-hour` (234.48, 10.25). Use `seasonInstant(year, event)` to find the day, `risingLst`/`settingLst` to find the hour, and compare. Also: the sun is below the horizon at hour 0 for every day; azimuth is 0 to 360.
- [ ] **Step 2: Run `npx vitest run packages/sky/src/sunpath.test.ts`; it fails with "sunAt is not exported".**
- [ ] **Step 3: Implement.** Convert (epoch, day, hour) to a JDE: the year's January 1 from `calendar.ts`, plus day minus 1, plus hour/24, minus longitude/360 to go from local mean solar time to UT (the frame's longitude is `g1.center.longitude`, positive east). Get RA and declination of date, the local sidereal time from the JDE and longitude (Meeus 12.4, mean sidereal time is enough), then `altAz`. Apparent altitude through `apparentAltitude` only above the refraction limit, as `sky-bake.ts` does.
- [ ] **Step 4: Run the test until it passes; run `pnpm test` for the whole package.**
- [ ] **Step 5: Commit** `packages/sky/src/sunpath.ts packages/sky/src/sunpath.test.ts packages/sky/src/index.ts packages/sky/src/browser.ts` with message "Place the sun for any day and hour of an epoch, checked against the sky bake".

### Task A2: renderer, tone mapping, shadows, post chain

**Files:**
- Create: `apps/web/src/scene/Renderer.tsx`
- Modify: `apps/web/src/scene/Scene.tsx`

**Interfaces produced:** `<Renderer quality="full" | "reduced">` wraps the post chain: SMAA, N8AO (radius about 12 m in world units, intensity a look choice), Bloom (threshold high, intensity low, for the sun's glints only), Vignette (faint), ToneMapping AgX. The Canvas gets `gl={{ antialias: false, powerPreference: 'high-performance' }}`, `shadows`, `toneMapping` set on the renderer to AgX with exposure as a look choice, and `flat={false}`. Cascaded shadow maps from `three/examples/jsm/csm/CSM.js` with 3 cascades over 3 km, following the sun direction from Task A3, applied to every material the scene creates (CSM patches materials; call `csm.setupMaterial` in each material's ref effect, or use the `CSM` helper's `updateMaterials`).

- [ ] **Step 1:** Install nothing new (deps are on trunk). Read `postprocessing` and `@react-three/postprocessing` docs for the versions installed; confirm they run on three 0.186 and R3F 9 (check their package.json peer ranges).
- [ ] **Step 2:** Write `Renderer.tsx` and mount `<EffectComposer>` as the last child of the Canvas. Keep `localClippingEnabled` (the section cut needs it).
- [ ] **Step 3:** Cascaded shadows: create the CSM in a component that reads the sun direction from the store's moment (Task A3 supplies `useSun()`), `csm.update()` every frame, and re-setup materials when they mount. The three pyramids, the plateau masses, the ground and the stand-ins all receive and cast.
- [ ] **Step 4:** Run the dev server, open a tab, screenshot: shadows fall from the pyramids across the ground with soft edges, no acne, no peter-panning; the bloom only touches the brightest sky and specular pixels.
- [ ] **Step 5:** `pnpm typecheck`; commit named files: "Give the viewer a post chain, AgX tone mapping and cascaded shadows".

### Task A3: the sky and the sun

**Files:**
- Create: `apps/web/src/scene/Sky.tsx`
- Modify: `apps/web/src/scene/Scene.tsx`, `apps/web/src/scene/SkyDome.tsx`

**Interfaces produced:**

```ts
/** The sun for the store's epoch and moment at the model's observer, memoised. */
export function useSun(): { direction: Vector3 /* world frame, unit, toward the sun */; altitudeDeg: number; azimuthDeg: number; up: boolean };
export function Sky(): JSX.Element;  // physical sky mesh, the sun light, the environment map, and the star dome at night
```

- [ ] **Step 1:** `useSun` calls `sunAt` with the store's `epoch` (through `sceneEpoch`), `moment`, `model.latitudeDeg` and `env['g1.center.longitude']`. Convert altitude and azimuth to a world-frame direction with `enuDirection` then `[e, u, -n]`.
- [ ] **Step 2:** Sky: use `three/examples/jsm/objects/Sky.js` (Preetham) on a 50 km sphere with turbidity, rayleigh, mie as look choices tuned per altitude (dust at dawn and dusk, clear at noon). Set `sunPosition` from `useSun`. The `directionalLight` follows the same direction with intensity and colour from the altitude (a small table: below -6 deg off, at 0 deg 0.4 and deep orange, at 15 deg 2.2 warm, at 60 deg 3.0 near white; interpolate). Hemisphere light from the sky's zenith and the ground's colour.
- [ ] **Step 3:** Environment map: render the sky mesh into a PMREM cube each time the sun moves more than a degree (drei's `Environment` with a `<Sky>` child inside `frames={1}` re-rendered on change, or a manual `PMREMGenerator.fromScene`). Every standard material then has sky reflections; the pristine casing needs this later.
- [ ] **Step 4:** Night: when the sun's altitude is below -6 deg, fade the star dome in (the existing `SkyDome`, now a child of `Sky` rather than a layer), dim the sky mesh, and make the ambient a deep blue. The `sky` layer toggle now only shows or hides the horizon ring and the star labels. The Milky Way: load `apps/web/public/sky/milkyway-2k.webp`, an equirectangular made by `scripts/web-textures.py` from the NASA EXR in `build/sky/`, and turn it with the same `equatorialToHorizon` rotation the dome uses (the dome's own matrix), additive, faint.
- [ ] **Step 5:** Screenshots at the four `MOMENTS`: dawn (long shadows west, orange), winter dusk (the panorama light, south faces lit), summer sunset (sun in the notch from the akhet camera), midnight (stars, Milky Way, the pyramids as silhouettes with a little starlight).
- [ ] **Step 6:** Commit: "Light the viewer from the sky package: a physical sky, the sun of the moment, and the stars at night".

### Task A4: air

**Files:**
- Create: `apps/web/src/scene/Atmosphere.ts`
- Modify: every material the scene creates (through one helper), `apps/web/src/scene/Scene.tsx` (remove the flat fog)

**Interfaces produced:** `applyAtmosphere(material, uniforms)` patches `onBeforeCompile` to add aerial perspective: an in-scattering term rising with distance and falling with height (exponential height fog, scale height about 800 m, density a look choice per state later), tinted by the sun colour near the sun's direction and by the sky colour elsewhere, and out-scattering that desaturates and lifts distant blacks. Uniforms are shared through a module-level object updated once a frame from `useSun`. Must compose with the `stone` triplanar patch (chain `onBeforeCompile` functions rather than replacing).

- [ ] **Step 1:** Write the helper and a `useAtmosphere()` hook that updates the shared uniforms each frame.
- [ ] **Step 2:** Apply it in `Pyramids.tsx`, `Terrain.tsx`, the massings and the stand-in loader's materials (Track D calls the same helper; export it from `Atmosphere.ts` with a stable name).
- [ ] **Step 3:** Screenshot from the panorama camera: Menkaure sits back in the air, the horizon dissolves into the sky rather than ending in a fog line. Compare with `docs/progress/0026-blender-panorama-today.png` side by side.
- [ ] **Step 4:** Commit: "Put air between the camera and the far pyramids".

### Task A5: stone with relief

**Files:**
- Modify: `scripts/web-textures.py` (write `<role>-normal.webp` and `<role>-rough.webp` at 2048 alongside the colour map, from the Poly Haven `nor_gl` and `Rough` maps; fetch them with `scripts/textures.py` if `textures.json` does not list them yet, adding "nor_gl" to its `maps`)
- Modify: `blender/textures.json` (add "nor_gl" to `maps`)
- Create: `apps/web/src/scene/materials/stone.ts` (moved from `scene/stone.ts`), `apps/web/src/scene/materials/index.ts`
- Modify: `apps/web/src/scene/Pyramids.tsx`, `apps/web/src/scene/Terrain.tsx`

**Interfaces produced:** `useStone(role)` returns colour, normal and roughness textures; `applyStone(material, stone, strength, scale)` does triplanar colour, normal (with the per-axis normal blend) and roughness. The stepped core gets block-to-block tone variation from a cell noise on the face's world position (as `render_materials.wire_core` does with `block_cells`), so each course reads as blocks. The casing role gets a faint joint line on the course levels the model carries (`params.courses`), passed as a small `DataTexture` of course tops.

- [ ] **Step 1:** Extend the texture export and rerun it (`python scripts/textures.py && python scripts/web-textures.py`); confirm six roles each with three maps in `apps/web/public/textures/index.json`.
- [ ] **Step 2:** Rewrite the triplanar patch with normals and roughness; keep the far and near two-scale trick.
- [ ] **Step 3:** Ground: sand with the gravel mix by a large noise (as `wire_sand`), and a slope-based blend to bedrock on steep faces.
- [ ] **Step 4:** Screenshot close on Khufu's north-east corner at dawn: courses read as blocks with relief; screenshot the ground: no visible tiling from 300 m.
- [ ] **Step 5:** Commit: "Give the viewer's stone its relief and the ground its gravel".

### Task A6: hero looks and a snapshot

**Files:**
- Create: `apps/web/src/looks.ts`
- Modify: `apps/web/src/scene/Scene.tsx` (nothing else; Track C wires the buttons)

**Interfaces produced:**

```ts
export const LOOKS: ReadonlyArray<{ id: 'dawn'|'panorama'|'harbour'|'akhet'|'night'; label: string; camera: CameraView; moment: Moment; note: string }>;
```
The cameras are the Blender `VIEWS` in `blender/render.py`, converted from the data frame `(e, n, u)` to the world frame `[e, u, -n]`; the moments are the bake moments each view names, expressed as `MOMENTS` entries (add any missing to `view.ts` `MOMENTS` only if Track C has not; coordinate through the director).

- [ ] **Step 1:** Write `looks.ts` and a test that every look's camera is finite and its moment is within range.
- [ ] **Step 2:** Screenshot each look; save the best two to `docs/progress/log/` with `python scripts/log-render.py` and propose them to the director as snapshot 0028 candidates.
- [ ] **Step 3:** Commit: "Name the hero looks the Blender views proved".

---

## Track B: the builders Stage 2 stands the plateau up with

Owner: one agent. Branch `stage1/builders`. Owns new files in `packages/geometry/src/` and `blender/seked_data.py` mirrors where stated. No scene wiring. Pure functions, each with a vitest file, each returning the `Mesh` type `packages/geometry/src/mesh.ts` defines (positions Float32Array, indices Uint32Array, vertexCount, triangleCount), in the data frame, metres, with a `label` string naming what is reconstruction.

Read first: `packages/geometry/src/footprints.ts` (`Footprint`, `footprintMesh`, `insetRing`, `triangulate`, `footprintSpan`), `packages/geometry/src/profile.ts` and `mesh.ts` (`pyramidGeometry`), `packages/geometry/src/courses.ts`, `data/measurements/tier3.json` or wherever `tier3.*` keys live (find with grep), `data/footprints/giza.json` header.

### Task B1: pyramidion

**Files:** Create `packages/geometry/src/pyramidion.ts`, `pyramidion.test.ts`; export from `index.ts`.

**Produces:** `pyramidionMesh(env, structure: 'g1'|'g2'|'g3'): Mesh | undefined`: a small pyramid whose slope is the structure's own (`<id>.slope` or derived from base and height as `profile.ts` does) and whose height is `<id>.pyramidion.height` (already in the database), sitting with its apex at the structure's apex. Test: its apex is at (offsetEast, offsetNorth, offsetUp + height.original) and its face angle equals the structure's within 1e-9.

### Task B2: cased and stepped small pyramids from footprints

**Files:** Create `packages/geometry/src/smallpyramid.ts`, test; export.

**Produces:** `smallPyramidMesh(f: Footprint, env, state: 'cased'|'stepped'): Mesh | undefined` for `group === 'queens'`: base from the footprint's outline fitted to a square (side = sqrt(area), centred on the centroid, turned to the outline's principal axis), height from the footprint or its `heightKey`, slope from `tier3.queens.slope` if the database has it, else the height and base. `cased` is a smooth four-face pyramid; `stepped` is a stepped core with course height `tier3.mastaba.course.height` (a labelled reuse) truncated at 0.8 of the height as a ruin. Test: base area within 2 percent of the outline's area; cased apex at the right height; stepped never exceeds 0.8 height.

### Task B3: mastaba

**Files:** Create `packages/geometry/src/mastaba.ts`, test; export.

**Produces:** `mastabaMesh(f: Footprint, env, state: 'cased'|'ruined'): Mesh | undefined` for `group === 'mastabas'`: the battered prism `footprintMesh` already builds (reuse it), plus in `cased` a fine casing skin (the same prism inset by 0.05 m with a flat top and a small chapel block on the east side, 3 by 2 by 2.5 m, centred on the east face), and in `ruined` the prism cut at a random fraction of its height between 0.3 and 0.7 seeded by the footprint id (deterministic). Test: determinism (same id, same mesh), the chapel sits on the east side (its centroid's east exceeds the prism's), ruined top below cased top.

### Task B4: temple

**Files:** Create `packages/geometry/src/temple.ts`, test; export.

**Produces:** `templeMesh(f: Footprint, env, state: 'whole'|'ruined'): { walls: Mesh; roof?: Mesh; pillars?: Mesh; label: string } | undefined` for `group === 'temples'`: walls are the footprint ring extruded to `tier3.temple.height` with a wall thickness of 4 m (a look choice named in the label) as an outer ring minus an inset ring; `whole` adds a flat roof slab 1 m thick and a grid of square pillars 1.5 m across at 5 m pitch inside the inner ring, clipped to it; `ruined` lowers the walls to 0.25 of the height. Test: `whole` has pillars all inside the inner ring; wall volume is positive; ruined height is a quarter.

### Task B5: roofed causeway and enclosure walls

**Files:** Create `packages/geometry/src/enclosure.ts`, test; export. Modify `packages/geometry/src/footprints.ts` only to export `khafreCausewaySegments` if needed.

**Produces:** `enclosureWallMesh(env, structure): Mesh | undefined` : a wall ring around each great pyramid at the distance the database carries (`<id>.enclosure.distance` if present, else `tier3.enclosure.distance` if present, else undefined so nothing is invented); height `tier3.enclosure.height` likewise. `causewayRoofMesh(env, features): Mesh | undefined`: a slab over Khafre's causeway's segments, thickness `khafre.causeway.thickness`. Test: a missing key yields undefined (nothing typed).

### Task B6: the Sphinx enclosure trench

**Files:** Create `packages/geometry/src/trench.ts`, test; export. Create `data/measurements/sphinx-enclosure.json` only if a published plan can be read with `scripts/plate.py` in this task; otherwise return undefined and note it in the label.

**Produces:** `sphinxTrenchMesh(env, features): { floor: Mesh; walls: Mesh } | undefined` from the Sphinx footprints: the enclosure outline as the union of the three Sphinx outlines dilated by `sphinx.enclosure.margin` if the database has it (else undefined), the floor at the Sphinx's base level, the walls vertical to the plateau's ground. Test: undefined without the key.

### Task B7: Python parity for what Blender will also draw

**Files:** Modify `blender/seked_data.py`; add a parity test in the existing pattern (see how `footprintMesh` parity is tested, grep "parity").

Mirror B1 (pyramidion) and B2 (small pyramids) only; the rest are web-only reconstructions for now and their labels say so.

Commit after each task with the message pattern "Build <thing> from the footprints and the database".

---

## Track C: the interface shell

Owner: one agent. Branch `stage1/shell`. Owns `apps/web/src/App.tsx`, `apps/web/src/panels/**`, `apps/web/src/ui/**` (new), `apps/web/src/styles.css`, `apps/web/index.html` (fonts). Reads `store.ts` and `view.ts` (`STATES`, `MOMENTS`, `state`, `moment`, `setState`, `setMoment`) and `looks.ts` if present (Track A6; if not yet merged, define the looks table locally under `ui/looks.ts` with the same shape and the director reconciles).

Design brief (from the spec, section 5.4): a full-bleed stage with dark glass instruments over it. Top-left wordmark and caption line. Bottom centre: the timeline (four stops) and the sun dial (day and hour). Right edge: an icon rail opening drawers: Views, Layers, Claims, Section, Sky, Tour, About. Hover labels in scene are Track D's for stand-ins; the caption is Track C's. Serif display (Fraunces or Cormorant Garamond from Google Fonts), humanist sans for controls (Inter or IBM Plex Sans), tabular numerals. Palette tokens on `:root`: `--glass: rgba(10,12,14,.72)`, `--ink: #ece6d8`, `--ink-soft: #a9a294`, `--sand: #d9b56a`, `--lapis: #2d5fa8`, `--fits: #6fbf8a`, `--misses: #d97b62`. Phone width: the rail becomes a bottom sheet.

### Task C1: the stage and the rail

**Files:** Modify `App.tsx`, `styles.css`; create `ui/Rail.tsx`, `ui/Drawer.tsx`, `ui/Caption.tsx`.

- [ ] Rewrite `App.tsx` so the `Scene` fills the viewport, the caption sits top-left, the rail on the right, one drawer open at a time (state in a small zustand slice `ui.ts` under `apps/web/src/ui/`, not in the URL). Every existing panel component (`Tour`, `PresetPicker`, `CubitSlider`, `SkyControls`, `LayerToggles`, `SectionControls`, `Claims`) is mounted inside the drawer it belongs to, unchanged in behaviour.
- [ ] The caption reads from `STATES` and the store: "As it stands · 2026 · 21 December, 15:30 local · survey". Its last word is the state's `kind`.
- [ ] Keyboard: Escape closes the drawer; number keys 1 to 4 set the state; the existing tour keys keep working.
- [ ] Screenshot at 1600 by 900 and at 390 by 844 (phone). Commit: "Put the scene full-bleed under a rail of drawers".

### Task C2: the timeline and the sun dial

**Files:** Create `ui/Timeline.tsx`, `ui/SunDial.tsx`; modify `styles.css`.

- [ ] Timeline: four stops on a rule, the active one filled, labels beneath, the epoch in small numerals; clicking sets the state (and the epoch, through `setState`); left and right arrow keys move a stop. Make it feel like an instrument, not a form.
- [ ] Sun dial: a half-circle of the day with the sun's arc; a drag along the arc sets `hour`; a small season picker (the four `MOMENTS` presets plus a day slider in a popover) sets `day`. Shows the moment's hour as "15:30".
- [ ] Screenshot both; commit: "Add the timeline and the sun dial".

### Task C3: the Views drawer and the Claims drawer restyle

**Files:** Create `ui/Views.tsx`; modify `panels/Claims.tsx`, `panels/ClaimDetail.tsx` (class names and layout only, no logic), `styles.css`.

- [ ] Views: one button per look (`LOOKS`), each setting the camera with `showCamera` and the moment with `setMoment`; a note under each from the look's `note`.
- [ ] Claims: the list as rows with the id, title, residual and the fit chip in the new palette; the detail as a card. Keep every element that exists (comparisons, inputs, ghosts, warnings).
- [ ] Screenshot; commit: "Restyle the claims and add the views drawer".

### Task C4: the About drawer

**Files:** Create `ui/About.tsx`.

- [ ] One page: what Seked is (from CLAUDE.md's first paragraph), the honesty rules in five lines, the sources of the textures and stand-ins (read `apps/web/public/textures/index.json` and, when present, `apps/web/public/models/manifest.json` at runtime and list attributions), links to the dossier and the progress page.
- [ ] Commit: "Say what the viewer is and where its surfaces come from".

---

## Track D: the asset pipeline

Owner: one agent, working in the main checkout (it needs `build/models`, `build/textures` and Blender). Branch `stage1/assets` created from the trunk in the main worktree; commit only named files. Owns `blender/export_web.py`, `scripts/web-assets.ts`, `apps/web/src/scene/Standins.tsx`, `apps/web/public/models/**` (gitignored output plus a committed `manifest.json`? No: the manifest is generated and gitignored too; `site.ts` copies what the build has), `.gitignore`, `package.json` scripts `web-assets` and the `build:web` chain.

### Task D1: export fitted stand-ins from Blender

**Files:** Create `blender/export_web.py`.

**Produces:** `blender -b build/seked.blend -P blender/export_web.py -- --out build/web-models [--only sphinx-meshy]` writes, for every non-retired model in `blender/models.json` and for each of its finishes, `build/web-models/<id>[-<finish>].glb` and `build/web-models/index.json`. Each GLB: the model imported, cut and reduced as `render_standins.cut_and_reduce` does, fitted with `render_standins.fit` (import those functions; do not copy them), with its own textures kept (`keep_materials=True`) and, where `material` is `texture+stone`, the stone detail baked to a second colour map is NOT attempted in this stage: keep the GLB's own PBR maps. Three decimation levels exported as three primitives in one glTF node named `lod0`, `lod1`, `lod2` at 300k, 60k and 15k faces. Exported with `export_yup=True` (the glTF exporter's default) after parenting to an empty that carries the scene's data-frame rotation, so a vertex in the GLB is the vertex in the .blend. Custom extras on the node: `seked` = the manifest entry (id, states, variant, evidence, attribution, license, url).

- [ ] Write it; run it for `sphinx-meshy` first; open the GLB in a quick three.js check (`node` with `@gltf-transform/core` to read node names and extras) and confirm the fitted bounding box is 75 m along its axis at the OSM Sphinx's position (compare with the footprint centroid from `data/footprints/giza.json`).
- [ ] Run for every model; log sizes. Commit `blender/export_web.py`: "Export the fitted stand-ins from Blender for the viewer".

### Task D2: compress for the web

**Files:** Create `scripts/web-assets.ts`; modify `package.json` (`"web-assets": "tsx scripts/web-assets.ts"`, and `build:web` and `dev:web` run it after `web-textures.py`); modify `.gitignore` (`apps/web/public/models/`).

**Produces:** reads `build/web-models/index.json`, and for each GLB: `dedup`, `prune`, `weld`, `textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048] })`, `meshopt` with `MeshoptEncoder`, writes `apps/web/public/models/<id>.glb`, and `apps/web/public/models/manifest.json` = `[{ id, file, bytes, sha256, states, variant, evidence, attribution, license, url, lods: ['lod0','lod1','lod2'] }]`. Refuses any output over 20 MB and says which (then lower the texture size for that one to 1024 and retry). Exits quietly when `build/web-models` is missing.

- [ ] Write it; run; confirm every file under 20 MB and the manifest lists seven models.
- [ ] Commit `scripts/web-assets.ts package.json .gitignore`: "Compress the stand-ins for the web".

### Task D3: the loader

**Files:** Modify `apps/web/src/scene/Standins.tsx` (the trunk stub).

**Produces:** `<Standins />` reads the manifest once (fetch `${BASE_URL}models/manifest.json`, silent when missing), picks the models whose `states` include the store's `state` and whose `variant` is unset or matches the store's `sphinx` variant (add `sphinx: 'carved'|'lion'|'anubis'|null` to the store only if Track A has not; coordinate through the director; for Stage 1 use `null`, meaning the default model for the state), loads each with `GLTFLoader` + `MeshoptDecoder` (from `three/examples/jsm/libs/meshopt_decoder.module.js`), picks a LOD by camera distance (lod0 under 400 m, lod1 under 1500 m, lod2 beyond), applies `applyAtmosphere` from `scene/Atmosphere.ts` if that module exists (import it lazily and skip if not), enables cast and receive shadow, and hides the OSM masses the model `replaces` (the `Mass` components in `Pyramids.tsx` are keyed by footprint id; publish the hidden ids through the store: `hiddenMasses: Set<string>`, set by `Standins`, read by `Pyramids`). Hover: a `Label` (the existing `scene/Label.tsx`) with the model's `name`, its `evidence` tier and the first sentence of its `attribution`, shown while the pointer is over it.

- [ ] Write it; run the dev server; screenshot the excavated Sphinx standing on its outline in today's state, textured, shadowed, with the OSM prisms hidden; hover shows the label.
- [ ] Commit: "Load the fitted stand-ins in the viewer, labelled".

### Task D4: the reconstruction parts (if time allows in this stage)

Extend `export_web.py` with `--reconstructions`: for each part group `render_reconstruction.build_reconstructions` places, export one GLB per group (`temples`, `causeways`, `walls`, `queens`, `mastabas`, `pits`, `harbour`) with `states` from the manifest and `evidence: 'reconstruction'`. Do not load them in the viewer yet (Stage 2 decides what the procedural builders replace).

---

## Merge order and verification (director)

1. Merge B (no scene files) first, then D (Standins.tsx and scripts), then A (Scene.tsx and materials), then C (App and panels). Resolve `view.ts` and `store.ts` conflicts by hand.
2. `pnpm typecheck && pnpm test && pnpm build:web`, then `pnpm dev:web` and screenshot the five looks in today's state.
3. `python scripts/log-render.py` the best frame; add snapshot 0028 to `docs/progress/README.md`; `pnpm run deploy`; check https://seked.pages.dev.
4. Update `docs/geometry-blockers.md` "Order of work" and the memory file with the stage's outcome.
