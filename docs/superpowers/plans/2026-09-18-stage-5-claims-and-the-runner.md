# Stage 5: The heavy states made light, the claims in the new look, and the claims runner. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three things, in this order. First, the built and ancient states draw at the frame rate the today state already has, so the tour reads as motion and a film records in minutes rather than an hour. Second, the claims, which are what the model is for, live in the new interface: the drawer, the detail pane and every overlay in the stage's own look, with a style reserved for a claim that was proposed rather than filed. Third, the claims runner the project plan always intended: prose such as Hancock's goes in, a claim file the existing evaluator can grade comes out, in a package the viewer can call with the reader's own key and a CLI can call from the shell.

**Architecture:** Track Q changes nothing about what is drawn and only how much: the scattered plants get a level baked to a triangle budget rather than a ratio, a far ring that is cards, and shadows only near. Tracks R and S are the interface: `panels/Claims.tsx` and `panels/ClaimDetail.tsx` restyled into the drawer, and the overlay components under `scene/` given the palette and the labels the rest of the stage has. Track T is a new workspace package, `@seked/runner`, browser-safe like `@seked/claims/browser`: it turns prose into a `ClaimFile` with the Claude API's structured outputs, checks the file against the expression language and the environment's keys, evaluates it with the evaluator that grades the filed claims, and repairs once on failure. Track U mounts the runner in the viewer as a Propose drawer, the key held in the browser and sent nowhere but the API, and gives it a CLI.

**Tech Stack:** as stages 1 to 4. `meshoptimizer`'s simplifier (already in `scripts/web-assets.ts`) for the plants' scatter level. `@anthropic-ai/sdk` for the runner, model `claude-opus-5`, structured outputs through `client.messages.parse()` with `zodOutputFormat(...)` from `@anthropic-ai/sdk/helpers/zod`; the SDK's `dangerouslyAllowBrowser: true` in the viewer. `zod` (already a dependency of `@seked/claims`) for the schema the runner asks for.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md`, section 6 stage 5, section 5.4 for the drawer. CLAUDE.md's "Claims are data" rule is the contract for track T.

**Evidence for track Q (director, 2026-09-18, Chromium on the RTX 5070 Ti at 1600 by 900, the east face stand):** the today state draws at about 180 fps, the built and ancient states at 5 to 7. Hiding every instanced mesh with 700 instances takes built to 78 fps; hiding the grass (60,000 cards) changes nothing; turning the plants' shadows off alone gets 9. The plants are instanced from the coarsest level the asset baker made, and for the island tree, the acacia stand-in, that level is still 169,160 triangles across three meshes, so 700 of them are 118 million triangles a frame before the shadow passes. The date palm's coarsest level is 9,531, which at 700 is another 6.7 million. `LOD_RATIOS` in `scripts/web-assets.ts` are ratios of the finest level with an error bound of 0.001, and the simplifier stops at the error bound before it reaches the ratio on a mesh this dense. The cost is geometry, not the casing, the reflections, the water or the post chain.

## Global Constraints

Everything in the stage 1 to 4 plans holds: no em dashes; nothing typed twice; metres and degrees; the data frame under the one rotated group; motion writes through the view store; commit named paths; `pnpm typecheck` and `pnpm test` before every commit; `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; own branch in own worktree under `.claude/worktrees/`; screenshots through the browser tools in your own tab at 1600 by 900 (`pnpm --filter @seked/web dev -- --port <yours> --strictPort`, after `pnpm bundle && python scripts/web-textures.py && pnpm web-assets` once); no deploy; no `docs/progress/README.md`. Claim the repo with `python scripts/job.py claim <session>` before the trunk.

New for this stage:

- **A frame rate is a number in a commit message.** Every commit in track Q states the frame rate before and after at the five looks (`dawn`, `panorama`, `harbour`, `akhet`, `night`) in the built and ancient states, measured the same way each time: `requestAnimationFrame` counted over two seconds after the loading line has gone, in a tab at 1600 by 900 with nothing else drawing. The dev handle `window.__seked` (`motion`, `view`, `looks`, `r3f`) is there for this; `r3f().getState().gl.info` gives calls and triangles.
- **Nothing about a plant's placement is a measurement,** and nothing in this stage changes where a plant stands, only how it is drawn. `Vegetation.tsx`'s `LOOK` block stays the record of the look choices, and a new number goes there with a sentence.
- **The runner never writes into `data/claims/`.** A proposed claim is a file under `build/claims/` from the CLI or a row in the viewer's list, and a person moves it into `data/claims/` by hand after reading it. The `verified: false` rule and the "claims are data" rule are what this protects.
- **No key in the repo, the URL or a test.** The CLI reads `ANTHROPIC_API_KEY` from the environment or `~/.seked/keys.env` (where `SKETCHFAB_TOKEN` and `MESHY_API_KEY` already live); the viewer keeps the reader's key in `localStorage` under one name and sends it to `api.anthropic.com` and nowhere else; the address bar never carries it. Tests use a fake client and never touch the network.
- **SDK calls are written from the skill, not from memory.** Before writing a line that calls the Claude API, read the `claude-api` skill's `typescript/claude-api/tool-use.md`, the structured outputs section, and `typescript/claude-api/README.md`. The model is `claude-opus-5` and nothing else. Thinking is left at its default (adaptive). `max_tokens` is 16000.
- **Shared files:** `styles.css` is appended to under a banner comment naming the track; `App.tsx`, `ui.ts`, `Icons.tsx`, `store.ts` and `bundle.ts` are the trunk's and are touched only where a task names the line.

---

## The trunk (director, before the tracks branch)

- [x] `packages/claims/src/schema.ts`: `ClaimSchema.id` accepts `P\d+` as well as `[A-E]\d+`, and the schema gains `origin: z.enum(['filed', 'proposed']).default('filed')` and `prose: z.string().optional()` (the words the claim was proposed from; a filed claim has none). `normaliseClaim` passes both through. The dossier renderer skips `proposed` claims (there are none in `data/claims/`, and there must never be). Tests: a `P1` id parses, an `F1` id does not, `origin` defaults to `filed`.
- [x] `packages/runner/`: `package.json` (`@seked/runner`, `"exports": { ".": "./src/index.ts", "./browser": "./src/browser.ts" }`, dependencies `@anthropic-ai/sdk`, `@seked/claims`, `@seked/data`, `@seked/geometry`, `zod`), `tsconfig.json` like the other packages, `src/index.ts` and `src/browser.ts` exporting a stub `proposeClaim` that throws `not yet`. `pnpm install` so the lockfile carries the SDK.
- [x] `apps/web/src/ui/ui.ts` gains the `propose` drawer (`{ id: 'propose', label: 'Propose', hint: 'Put a claim to the model in your own words' }`) after `claims`; `Icons.tsx` its glyph (a pen nib or a question mark in the rail's line weight); `App.tsx` mounts `<Drawer id="propose"><Propose /></Drawer>` with a stub `ui/Propose.tsx` that says the runner is not here yet.
- [x] `apps/web/src/store.ts`: `proposed: Claim[]` and `addProposed(claim)`, `dropProposed(id)`; `model.ts`'s evaluation runs over `bundle.claims` and `proposed` together, and `panels/Claims.tsx` lists both (the restyle is track R's; here they only appear).
- [x] Commit: "Lay the trunk for stage 5: a proposed claim has a place to stand, and the runner has a package".

---

## Track Q: the heavy states made light

Branch `stage5/cost`. Owns `scripts/web-assets.ts`, `blender/props.json` (the `scatter_to` field only), `apps/web/src/scene/Vegetation.tsx`, `apps/web/src/scene/lod.ts` if it needs a band, and `apps/web/src/scene/Water.tsx` for Q5.

### Task Q1: measure and pin

- [x] Add `apps/web/src/scene/frames.ts`: `measureFrames(seconds = 2): Promise<number>` counting `requestAnimationFrame` calls, exported on the dev handle as `__seked.frames`. A `scripts/frames.md` note (ten lines) says how the number in every commit of this track was taken.
- [x] Record the baseline: built and ancient at the five looks, and today at the same, in a table in the commit message and in `docs/superpowers/plans/2026-09-18-stage-5-claims-and-the-runner.md` under this task (the director's numbers above are one stand; these are five).
- [x] Commit: "Count the frames the same way every time".

**The baseline (2026-09-18, Chromium at 1600 by 900 on the RTX 5070 Ti, the
median of three two-second counts at each stand, `scripts/frames.md`).**
Triangles are the per-frame total over every pass including the shadow
cascades, read off `gl.info` with its auto-reset turned off. Taken in a
browser nobody else was driving; the first run was taken in the session's
shared one and every number in the heavy states came out about a third low.

| Look | today | built | ancient | built calls | built triangles |
|---|---|---|---|---|---|
| dawn | 237.0 | 4.3\* | 4.8\* | 391 | 1,373,214,166 |
| panorama | 231.5 | 4.3 | 4.8 | 395 | 1,373,214,512 |
| harbour | 240.0 | 4.7 | 4.8 | 363 | 1,374,477,258 |
| akhet | 237.5 | 8.2 | 4.6 | 189 | 667,808,171 |
| night | 239.5 | 7.4 | 7.6 | 179 | 667,346,339 |

\* The first stand measured after a change of state reads 0.6 and 0.7,
because it carries the shader compilation of everything the new state just
brought in. The steady rate at that stand is the panorama's, which is the same
camera load; the compile figure is not the state's cost and is not quoted.

Today is at the display's own 240 Hz at four of the five stands, so those are
floors and not ceilings. It draws between 0.27 and 1.45 million triangles a
frame at the same five stands, so the heavy states cost about a thousand times
the geometry of the light one, and the two stands that run at twice the rest
(`akhet` and `night`) are the two with half the plateau behind the camera,
which is the shape of a geometry cost and not of a shading one.

### Task Q2: a scatter level baked to a budget

- [x] `blender/props.json`: each plant gains `scatter_to: { triangles: N }`, a look choice with a sentence: island tree 3000, date palm 2500, rooibos bush 600, shrub 600 (a tree seen from across the plateau; the near ones are Q4's). `scripts/web-assets.ts` bakes one more level, `scatter`, for any prop with `scatter_to`: the simplifier run to the ratio that hits the budget with the error bound relaxed (`error: 0.05`, then `0.2` if the budget is still missed; `lockBorder` off), and a line in the console saying the triangles it reached. `props/manifest.json` reports `scatter` in `lods` and the triangle count per level (`levels: { lod0: n, ..., scatter: n }`; `triangles` was always null and goes away).
- [x] `Vegetation.tsx`: `partsOf(group, 'scatter')`, falling back to the last of `lods` only when `scatter` is absent, with a `console.warn` naming the prop. The comment at that line is rewritten to say what happened: the coarsest ratio level of the acacia was 169,160 triangles.
- [x] Verify: built and ancient at the five looks, in the commit message. Expected: the plants' triangles down from about 125 million to under 4 million; the frame rate within a third of today's.
- [x] Commit: "Bake the scattered plants to a triangle budget rather than a ratio".

### Task Q3: the far ring is cards

- [x] Beyond `LOOK.cardMetres` (a look choice; start at 900 m from the camera) a plant is a cross of two textured quads facing the camera's yaw, the texture baked by `scripts/web-assets.ts` from the plant's own textures at 256 px (a front and a side of the scatter level rendered with `@gltf-transform`'s scene, or, if a render is more than the script should carry, the crown's leaf texture on two quads scaled to the plant's `size` from the manifest). Which the baker does is the track's call and is said in the file. Near and far are two instanced meshes per plant kind with a shared placement list and a hysteresis band of 60 m (`lod.ts`'s pattern), so a slow move does not flicker a tree between mesh and card.
- [x] The cards dissolve with everything else (stage 4's fade) and are clipped by the section like the meshes.
- [x] Verify at `panorama` and `dawn`, where most of the plants are far: the number, and a screenshot at each with the cards on and, for comparison, off.
- [x] Commit: "Draw the far plants as cards, with a band so a tree does not flicker".

### Task Q4: shadows near, none far

- [x] Only the near instanced mesh of each plant casts shadows, and only when its instance is inside the first cascade's far plane (`LOOK.shadows.maxFar` split by CSM's `practical` mode; read `csm.breaks` off the cascades rather than typing a metre figure). The far cards never cast. The grass never did.
- [x] Verify: the number at the five looks; a screenshot at `harbour` in the ancient state at 16:00 showing the near palms' shadows still on the ground.
- [x] Commit: "Cast the plants' shadows near and nowhere else".

### Task Q5: the water's flat edge, and the film's rate

- [x] From the night stand (`night` look, the rollback film's camera) the flood plain's water shows a hard flat edge at the left horizon. Find why (the plane's extent against the terrain's, the far clip, or the water's own fade) and fix it in `Water.tsx` so the edge is under the horizon haze or inside the terrain; a screenshot from that stand at night, before and after.
- [x] Record "The tour, the first two shots" at 1080p and note the frames a second of the run in the commit message (it was about 4 in the heavy states on 2026-09-17; the run is bound by the same geometry).
- [x] Commit: "Put the water's edge under the horizon, and time the film".

---

## Track R: the claims drawer in the new look

Branch `stage5/drawer`. Owns `apps/web/src/panels/Claims.tsx`, `apps/web/src/panels/ClaimDetail.tsx`, their tests, and one section at the end of `styles.css`.

### Task R1: the list

- [ ] The list in the drawer's type and colour: the group heading in the serif display face, each row the id in tabular numerals, the title, and the grade as a dot and a word (`fits` in the existing green, `misses` in the existing red, `needs sky` and `needs site` in the muted sand) rather than a paragraph. A `proposed` claim's row carries a small `proposed` tag in lapis and sorts to the top of its group. The selected row stays open with the detail under it, as now. Keyboard: up and down move, enter opens, escape closes the detail.
- [ ] Commit: "List the claims in the drawer's own type".

### Task R2: the detail

- [ ] The detail pane reads top down: the summary; the comparisons as a small table (formula, value, target, residual, with the worst one marked); the free choices as a list with the word `assumed`; the epoch where there is one, formatted as the caption line formats it; the sources split `for`, `context`, `against` with the source's short title from `data/sources.json`; the records the numbers came from, each with its `verified` flag as a glyph and its `method` where it is not a transcription. A proposed claim adds its `prose` in quotation marks at the top and a `Move into data/claims` note that says what to do by hand (there is no button that does it).
- [ ] The overlay note and the `drawn` state stay; the button that toggles the overlay is the drawer's button style.
- [ ] Commit: "Read a claim top down: what it compares, what it assumed, who says so".

### Task R3: the honesty word

- [ ] The caption line's honesty word (`survey`, `reconstruction`, `claim`) already changes with the state; with a claim open it becomes `claim` and, for a proposed one, `proposed`. One line in `ui/Caption.tsx` and its test.
- [ ] Commit: "Say proposed on the caption line when a proposed claim is open".

---

## Track S: the overlays in the new look

Branch `stage5/overlays`. Owns `apps/web/src/scene/ClaimOverlay.tsx`, `apps/web/src/scene/GhostProfile.tsx`, `apps/web/src/scene/Label.tsx`, `apps/web/src/overlays.ts` (colours and the `proposed` flag only), and one section at the end of `styles.css`.

### Task S1: one palette

- [ ] Every overlay type (the sixteen in `data/claims/*.yaml`: `ghost-profile`, `ghost-profiles`, `ghost-earth`, `shaft-rays`, `passage-ray`, `sky-projection`, `compass-rose`, `ground-bearings`, `ground-line`, `ground-outlines`, `ground-rectangle`, `chamber-wireframe`, `akhet`, `sun-ribbon`, `map-inset`, `panel`) draws in the stage's palette: lapis for the claim's own geometry, the warm sand for the survey it is drawn against, the existing green and red only for a fit or a miss mark. `RAY_COLOURS` and `SIGHT_COLOUR` move to a `PALETTE` in `overlays.ts` with a sentence each. Lines go through the post chain like everything else (no `depthTest: false` unless the type needs to show through the pyramid, and then the line is drawn twice, the occluded pass dimmer).
- [ ] Labels (`Label.tsx`) match `HoverTag.tsx`: the same face, the same glass, tabular numerals, and a leader line to the point they name.
- [ ] Screenshots: A1 (`ghost-profile`) from the east face stand, C2 (`shaft-rays`) from the night stand, B1 (`ghost-earth`) from the panorama, D3 (`ground-bearings`) from above; each in the built state and one of them at night.
- [ ] Commit: "Draw every overlay in the stage's palette, with the labels the stage already has".

### Task S2: the proposed style

- [ ] An overlay for a claim whose `origin` is `proposed` draws dashed, at three quarters the opacity, with the label prefixed `proposed`. `overlays.ts`'s spec builders take the claim and pass `proposed: boolean` through; the components read it. A test that a spec built from a `P1` claim carries the flag.
- [ ] Commit: "Dash the overlay of a claim that was proposed rather than filed".

### Task S3: the overlay in a film

- [ ] Check every overlay through the stepped clock: record the tour's shot four (`Inside the Great Pyramid`) and shot five (the shafts) at 720p and confirm the overlays and labels are in the frames at full size (labels are HTML; if they are not in the canvas they are not in the film, and the fix is to say so in `Film.tsx`'s note and draw the film's labels as sprites, or to leave them out of films and say that; the track decides and writes it down).
- [ ] Commit: "Say what an overlay is in a film, and make it so".

---

## Track T: the claims runner

Branch `stage5/runner`. Owns `packages/runner/` and `scripts/claim.ts`.

### Task T1: the context the model is given

- [ ] `packages/runner/src/context.ts`: `runnerContext(bundle): RunnerContext` builds, from the same bundle the viewer loads (`apps/web/public/seked.json`, or the loader in Node), the system prompt's material: the expression language's grammar (read `packages/claims/src/expr.ts` and state it in twenty lines: identifiers, dotted keys, the operators, the functions, `pi`), every identifier the environment has (`Object.keys(env)` grouped by structure, with the unit of each from its record), the units rule (metres and degrees; `rc` and `in` are claim units; a ratio is unitless), the tolerance rule (`tolerance_pct` default 0.5; `tolerance_abs` for a target of zero), the groups, the overlay types the viewer can draw with each one's `params`, and six filed claims as worked examples (A1, A3, B1, C2, D1, D3) each with the prose that a proponent would say and the file it became. Nothing in the prompt is typed twice: the examples are read from `data/claims/`, the keys from the bundle.
- [ ] A test that the context names every key in the environment and no key that is not in it, and that the examples parse back to the files they came from.
- [ ] Commit: "Tell the model what a claim file is and which numbers exist".

### Task T2: prose to a claim file

- [ ] `packages/runner/src/propose.ts`: `proposeClaim(prose, context, client, options?): Promise<Proposal>` where `Proposal = { claim: ClaimFile; result: ClaimResult; repairs: number; usage: { input: number; output: number } }`. One call to `client.messages.parse()` with `output_config: { format: zodOutputFormat(ProposalSchema) }` where `ProposalSchema` is `ClaimSchema` narrowed for the model (id is assigned by the runner, not the model: `P` and the next free number; `origin` is `proposed`; `prose` is the input; `verified` is not a claim field and is not asked for). Then the checks: every identifier in every formula and target is in the environment (the expression parser's `identifiers()`), the formula parses, the claim evaluates without throwing. On any failure, one repair round: the same request with the errors appended as a user turn, then give up and throw `ProposalFailed` carrying the last file and the errors. The client is an argument so the tests pass a fake that returns a canned `parsed` message.
- [ ] Tests with the fake client: a well-formed answer comes back evaluated; an answer naming a key that does not exist is repaired once; an answer that is still wrong throws with both attempts in it. No network.
- [ ] Commit: "Turn prose into a claim file the evaluator can grade, and repair it once".

### Task T3: the Hancock examples

- [ ] `packages/runner/src/examples.ts`: five claims in the proponent's own kind of words, paraphrased and not quoted (Hancock 1995 on the shafts and Orion's belt, the 10,500 BCE lion and Leo, the Great Pyramid as a scale model of the northern hemisphere, the site plan's Orion correlation, the equinox sun on the Sphinx), each with a sentence saying which filed claim it is near and what to expect the runner to do with it. These are the viewer's buttons in track U and the CLI's `--example` list.
- [ ] Commit: "Five things a proponent says, ready to be put to the model".

### Task T4: the CLI

- [ ] `scripts/claim.ts` and `"claim": "tsx scripts/claim.ts"` in the root `package.json`: `pnpm claim -- "prose"` or `pnpm claim -- --example 2`. It builds the context from the loader (Node, `@seked/data`), reads the key from the environment or `~/.seked/keys.env`, calls `proposeClaim`, writes `build/claims/P<n>.yaml` with a header comment saying the date, the model and the prose, prints the dossier's row for it (the dossier renderer on a one-claim list) and the token usage, and exits non-zero on `ProposalFailed` with the errors. It never writes under `data/`.
- [ ] Run it once for real on example 1 and paste the printed row into the commit message.
- [ ] Commit: "A claim from the shell, into build/ and never into data/".

---

## Track U: the runner in the viewer

Branch `stage5/propose`. Owns `apps/web/src/ui/Propose.tsx`, `apps/web/src/runner.ts` (the browser client and the key), and one section at the end of `styles.css`. Builds against track T's `@seked/runner/browser` as it stands on the trunk (the stub) and swaps in the real one at merge; until then its tests use the same fake client T's do.

### Task U1: the key

- [ ] `runner.ts`: `readerKey()` and `setReaderKey(key)` on `localStorage` under `seked.anthropicKey`; `runnerClient()` builds `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`. The drawer's first state is a field for the key with three sentences: it stays in this browser, it goes to `api.anthropic.com` and nowhere else, and each claim costs about what a page of text costs (read the price off the `claude-api` skill's table for `claude-opus-5` and say it in words, not a figure that will go stale). A `forget` link clears it.
- [ ] Commit: "Hold the reader's key in the browser and say where it goes".

### Task U2: the drawer

- [ ] `Propose.tsx`: a text area, the five example buttons from `@seked/runner/browser`'s `EXAMPLES`, a `Put it to the model` button, and a running line while it runs (`asking`, `checking`, `repairing once`). On success the claim goes into the store's `proposed`, is selected, and the Claims drawer's row and detail (track R) and its overlay (track S) show it. On `ProposalFailed` the drawer shows the model's last attempt and the errors in plain words, and offers to try again. A `Download as YAML` link on a proposed claim writes the file the CLI would have written.
- [ ] Tests: the drawer with a fake client adds a claim to the store; a failure shows the errors.
- [ ] Commit: "Put a claim to the model from the drawer, and see it graded".

### Task U3: the built context

- [ ] The context (T1) is built once from the loaded bundle and memoised; `scripts/bundle.ts` does not change (the runner reads the bundle the viewer already has). Check the prompt's size with `client.messages.countTokens` once in a test that is skipped without a key, and record the number in the commit message.
- [ ] Commit: "Build the model's context from the bundle the viewer already loaded".

---

## Merge order and verification (director)

1. Merge Q (cost) first and verify the numbers it claims; then R (drawer), S (overlays), T (runner), U (propose). Resolve `styles.css`'s tail, `App.tsx` and `store.ts` by hand.
2. Typecheck, test, build. Play the tour end to end on the wall clock in the built and ancient states; it should read as motion (the plan's bar is 45 fps or better at every stand at 1600 by 900 on the 5070 Ti). Record "The tour, the first two shots" at 1080p and note the run's rate against the 4 frames a second of 2026-09-17.
3. Run `pnpm claim -- --example 1` for real and open the viewer, put example 2 to the model with a key in the browser, and screenshot the proposed claim's row, detail and overlay.
4. Snapshot 0032 with a still of the tour in the ancient state at speed, a still of a claim in the drawer with its overlay, and a still of a proposed claim; deploy; the blockers doc's order of work gets a stage 5 paragraph; memory updated; the plan's boxes ticked.
