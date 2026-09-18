# Stage 4: Motion. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plateau move: the tour rebuilt as camera paths through the eras with the sky rolling back and the sun crossing the day, the changes of state choreographed inside those moves, and a way to record a film from the viewer at any resolution, frame by frame, so the browser carries the cinematic the Blender films proved.

**Architecture:** One motion engine (`apps/web/src/motion/`) plays a `Sequence` of `Shot`s by writing the view store's own fields every frame: camera along an eased path, moment and epoch and sidereal time tweened, the state changed at the second the shot names so the existing dissolve does the rest. It has two clocks: the wall clock for a reader pressing play, and a stepped clock the film exporter advances one frame at a time, so a film is the same shots rendered deterministically at full quality. The tour is one sequence with narration; two more are film presets. A fourth track makes the scene hold up under motion: the environment map rebuilt at a rate the sun's travel can afford, no LOD popping in a slow move, the water and the haze at dusk from moving stands.

**Tech Stack:** as stages 1 to 3. React Three Fiber's `frameloop="never"` and `advance()` for the stepped clock. WebCodecs `VideoEncoder` with `mp4-muxer` (npm, MIT) for the film, PNG frames through the File System Access API as the fallback. `@seked/sky/browser`'s `transitLst` for holding a star on the meridian.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md`, section 6 stage 4, and section 5.3 for the view state.

## Global Constraints

Everything in the stage 1, 2 and 3 plans holds: no em dashes; nothing typed twice (a shot's camera is a composition and says so; an epoch or a sidereal time in a shot is a claim's own, named by the claim id in a comment, or computed from the sky package); metres and degrees; the data frame under the one rotated group, cameras in the world frame `[east, up, -north]`; commit named paths; `pnpm typecheck` and `pnpm test` before every commit; `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; own branch in own worktree; screenshots through the browser tools in your own tab at 1600 by 900 (`pnpm --filter @seked/web dev -- --port <yours> --strictPort`, after `pnpm bundle && python scripts/web-textures.py && pnpm web-assets` once); no deploy; no `docs/progress/README.md`.

New for this stage:

- **The trunk is the contract.** `apps/web/src/motion/types.ts` and `apps/web/src/motion/store.ts` are on main at the commit the director names, with a minimal player in `apps/web/src/scene/Motion.tsx` that jump-cuts to each shot's first camera. Track M replaces the player; every other track builds against the types as they stand. A track that needs a field the types do not have adds it in its own branch with a comment and reports it, and the director reconciles at merge.
- **Motion writes through the store's own actions** (`setCamera`, `setMoment`, `setEpoch`, `setLst`, `setState`, `setClaim`, `toggleLayer`, `setSection`, `setSphinx`, `setMode`), so a frame of a film is a view a reader could have reached by hand and the address bar keeps mirroring it. No component reads the motion store to draw anything; the scene sees only the view store.
- **The wall clock is `useFrame`'s delta and nothing else.** No `Date.now()`, no `performance.now()`, no `setInterval` in motion code, so the stepped clock produces the same frames every run.
- **Shared files:** `styles.css` is appended to, never edited in the middle: each track adds one section at the end under a banner comment naming the track (`/* ===== Stage 4, Track N: the tour ===== */`). `App.tsx`, `Scene.tsx`, `ui.ts` and `Icons.tsx` are the trunk's and are not touched by any track except where a task below names the exact line.
- **Screenshots of motion** are two stills, at the start and part way through a shot, plus a short note of the frame rate the browser reported (`performance` panel or the `stats` you add and remove). A film track's proof is the file it produced, opened.

---

## The trunk (director, before the tracks branch)

- [x] `apps/web/src/motion/types.ts`: `Ease`, `Key<T>`, `CameraKey`, `Shot`, `Sequence` as below.
- [x] `apps/web/src/motion/store.ts`: `useMotion` with `sequence`, `shot`, `time`, `playing`, `clock`, `play`, `pause`, `resume`, `stop`, `seek`, `advance`, `setClock`.
- [x] `apps/web/src/scene/Motion.tsx`: the jump-cut player, mounted in `Scene.tsx` inside the Canvas; `frameloop` on the Canvas follows `clock`.
- [x] `ui.ts` gains the `film` drawer, `Icons.tsx` its glyph, `App.tsx` mounts `<Drawer id="film"><Film /></Drawer>` with a stub `ui/Film.tsx`.
- [x] Commit: "Lay the trunk for stage 4: the shot, the sequence and a player that cuts between them".

```ts
// apps/web/src/motion/types.ts (as committed on the trunk; read the file, it is the contract)
export type Ease = 'linear' | 'in' | 'out' | 'inOut';
export interface Key<T> { at: number; value: T; ease?: Ease }   // `at` in seconds from the shot's start
export interface CameraKey extends Key<CameraView> { lift?: number } // lift: 0..1, how high the path arcs (Track M)
export interface Shot {
  id: string;
  seconds: number;
  camera: CameraKey[];                 // one key is a stand; two or more are a path
  state?: { to: StateId; at: number; dissolveSeconds?: number };
  moment?: Key<Moment>[];
  epoch?: Key<number>[];
  lst?: Key<number>[] | { meridian: string };   // keys, or hold a named star on the meridian
  claim?: string | null;
  layers?: Partial<Record<LayerId, boolean>>;
  section?: Partial<Section>;
  sphinx?: SphinxVariant | null;
  title?: string;
  text?: string;
}
export interface Sequence { id: string; label: string; note: string; shots: Shot[] }
```

---

## Track M: the engine

Branch `stage4/engine`. Owns `apps/web/src/motion/ease.ts`, `motion/path.ts`, `motion/apply.ts`, `motion/index.ts`, their tests, `apps/web/src/scene/Motion.tsx` (replacing the trunk's), `apps/web/src/scene/fade.ts` (the dissolve's length only).

### Task M1: easing and keys

- [x] `motion/ease.ts`: `ease(kind, t)` for the four kinds (`inOut` is the smoothstep `t*t*(3-2t)`; `in` and `out` are its halves; `linear` is `t`), and `sample<T>(keys: Key<T>[], t: number, lerp: (a: T, b: T, u: number) => T): T`: before the first key hold its value, after the last hold that, between two keys ease with the later key's `ease` (default `inOut`). Lerps for a number, a `Moment` (day and hour separately, the hour the short way round a 24 hour circle only when the day also changes), a `CameraView` (position and target separately), and an angle in degrees the short way round (for `lst`). Tests: hold before and after, the midpoint of `inOut` is the midpoint, an lst from 350 to 10 passes through 0 and not 180.
- [x] Commit: "Ease between keys, the sidereal time the short way round".

### Task M2: camera paths that clear the ground

- [x] `motion/path.ts`: `cameraAt(keys: CameraKey[], t: number): CameraView`. Between two keys the position follows a quadratic Bezier whose control point is the midpoint lifted by `lift * distance` (default `lift` 0.25 when the two keys are further apart than 150 m, else 0; a look choice named as one), so a move across the plateau arcs over a pyramid rather than through it; the target moves in a straight eased line. The path never goes below `y = 2` m in the world frame (the ground is near 0 at the datum and the harbour floor is below it: 2 m is a look choice, and a shot that wants to stand lower puts both its keys there so no arc is needed). Tests: a stand returns its key; a move from 1000 m east to 1000 m west of the origin at 40 m up passes over the Great Pyramid's apex height (147 m from the database; read `g1.height` off the test bundle rather than typing it, or assert the midpoint is above 0.25 times the distance).
- [x] Commit: "Arc the camera over the plateau between two stands".

### Task M3: applying a shot to the view

- [x] `motion/apply.ts`: `applyShot(shot: Shot, time: number, store: ViewStore, scratch: Scratch)` where `Scratch` remembers what was last written so a value that has not changed is not written again (the store's `setMoment` clamps and rounds the day; write it only when the day or the hour moved by more than 1/240 of an hour). At `time === 0` (or the first call for a shot) it does what the old `applyStep` did: claim, layers, section, sphinx, mode `orbit`, and the state if `state.at` is 0. Every frame: `setCamera(cameraAt(...))`; if `moment` keys, `setMoment(sample(...))`; if `epoch` keys, `setEpoch(sample(...))` (an epoch key list ending at the state's own epoch should end by handing the epoch back with `setEpoch(null)` once `time` passes the last key, so the caption's "held there" goes out); if `lst` is keys, `setLst`, and if it is `{ meridian }` then `setLst(transitLst(star, epochNow))` from `@seked/sky/browser` with the star looked up in the bundle's named stars by id (the store does not hold the bundle: `applyShot` takes an `options.namedStars` map the player builds once from `useView`'s bundle, or the player passes a `meridianLst(starId, epoch)` function; keep it a function argument so the tests can fake it). When `time` reaches `state.at` the state is set once; when the shot has a `dissolveSeconds` the player sets `fade.ts`'s length for that dissolve (M4).
- [x] Throttle: `moment` and `epoch` writes are limited to twelve a second of shot time (a Scratch field holds the last write time); the camera is written every frame. Test with a fake store that records calls: a 10 second shot advanced in 1/60 steps writes the camera 600 times and the moment about 120.
- [x] Commit: "Play a shot through the store, twelve sun moves a second and the camera every frame".

### Task M4: the player

- [x] `scene/Motion.tsx` replaces the trunk's: `useFrame((_, delta) => ...)`: if `clock === 'wall'` and `playing`, `advance(delta)`; then, whatever the clock, if a sequence is loaded, `applyShot(shots[shot], time, useView.getState(), scratch)`. The trunk's `advance` already rolls a finished shot into the next and stops at the end; keep its semantics (read `store.ts`). When a sequence stops, the reader is left where the last shot put them, as the old tour did.
- [x] `fade.ts`: `DISSOLVE_SECONDS` becomes the default of a module-level `let` with `setDissolveSeconds(s)` and `resetDissolveSeconds()` exported; the player calls the setter just before a shot's state change and the reset after the dissolve has run (`t` reached 1). Nothing else in `fade.ts` changes.
- [~] Verify in the browser with a throwaway sequence in the console: `useMotion.getState().play({...})` from a `window.__seked` handle you add in `Motion.tsx` under `import.meta.env.DEV` only. A move from the panorama stand to the harbour stand over 8 s with the state going built to ancient at 3 s and the moment from dawn to dusk: smooth, no popping of the sun, the dissolve at the named second. Two screenshots.
- [x] Commit: "A player for the shots, on the wall clock or stepped by the film".

---

## Track N: the tour rebuilt

Branch `stage4/tour`. Owns `apps/web/src/tour.ts` (rewritten), `apps/web/src/tour.test.ts`, `apps/web/src/sequences.ts` (new: the film presets), `apps/web/src/ui/Tour.tsx` (new, replacing `panels/Tour.tsx`, which is deleted), `apps/web/src/ui/Narration.tsx` (new), the tour actions in `store.ts` (`startTour`, `nextStep`, `prevStep`, `endTour`, `goToStep` only) and the `tour` decode in `view.ts` (the `TOUR` import and the `framing` lines only), the `<Tour />` import and its one line in `App.tsx` (report it), a section at the end of `styles.css`.

### Task N1: the tour as shots

- [ ] `tour.ts` exports `TOUR: Sequence` whose `shots` carry the narration the old steps had (rewritten where the era order below changes what is on screen), and `TOUR_STEPS = TOUR.shots` for `view.ts`. The order goes through the eras: (1) the plateau today from the south-east, dawn, survey words; (2) fly to the Great Pyramid's east face, the state going to `built` as the camera arrives (`state.at` two thirds through), A1 ghost; (3) A3, same stand; (4) inside: the cut opens and the camera flies in along the section plane to the King's Chamber, A4; (5) C2: pull out north-west, the moment going to midnight over the move, the sky layer on, the epoch rolling from the state's 2450 BCE... hold it there with `lst: { meridian: 'alnitak' }` (the id in `data/stars/named.json`), the shaft ray; (6) C4: rise to the belt view; (7) C6: to the akhet stand from `looks.ts`, the moment tweened from 17:30 to 19:10 over the shot so the sun sets in the gap; (8) C5: behind the Sphinx, the state to `ancient` at the shot's start (the plateau greens as the camera settles), the epoch keys from -2449 to -10499 over ten seconds (Hancock and Bauval's epoch, C5's own), `sphinx: 'lion'`, the sky layer on, the overlay's Regulus; (9) D2 from above in `built`, `sphinx: null`; (10) B1; (11) the close: the plateau from the opening stand, the state to `stripped` at 3 s and `today` at 8 s, the dossier words. Cameras are the old steps' `cameraFrom` framings and the hero looks; travel between stands takes 6 to 10 s, each stand holds long enough to read its text (about 20 words a second is the rule: `seconds = travel + words / 3`). Every epoch and lst in a shot is a claim's own and says which in a comment.
- [ ] `sequences.ts`: `SEQUENCES: Sequence[]` = the tour, "The eras" (the panorama stand; `ancient`, `built`, `stripped`, `today` in that order, 15 s each, the moment sweeping 6:30 to 18:30 within each state, the epoch following the state), and "The rollback" (the night stand from `looks.ts`, the sky layer on, epoch keys 2026 to -2449 held 4 s then to -10499 held 4 s, twenty seconds in all, `lst: { meridian: 'alnitak' }`, the C2 overlay open: the film `scripts/sky-rollback.ts` bakes, in the viewer).
- [ ] `tour.test.ts`: every shot's `seconds` is positive and longer than its travel; every shot with text has a title; the tour opens and closes on `today`; the meridian star id exists in `data/stars/named.json`; every camera key is above `y = 2`.
- [ ] `store.ts`: `startTour` = `useMotion.play(TOUR, 0)`; `goToStep(i)` = `seek(i, 0)` with the sequence loaded if it is not; `nextStep`/`prevStep` seek; `endTour` = `stop()` and `tour: null`. The view's `tour` index mirrors `useMotion`'s `shot` while the tour sequence is the one loaded (subscribe in `store.ts` or set it from the actions; the URL keeps `?tour=N`). `view.ts` keeps decoding `?tour=N` against `TOUR_STEPS.length` and takes the step's first camera key as the framing.
- [ ] Commit: "Rebuild the tour as shots through the eras, and name the two film sequences".

### Task N2: the narration and the drawer

- [ ] `ui/Narration.tsx`: a band across the bottom of the stage above the instruments, dark glass, the shot's title in the serif face and its text in the sans, shown while a sequence with text is loaded, fading in at a shot's start (CSS transition on a key of the shot id). Below the text a thin progress rule for the shot and "3 of 11". It reads `useMotion`.
- [ ] `ui/Tour.tsx`: the drawer: "Take the tour" when nothing is loaded; while running, play/pause, back, next, end, and the list of shots by title (click seeks); the arrow keys and space as the old panel had arrows, with the same typing guard. Mounted in `App.tsx` in place of `panels/Tour.tsx` (one import, one element). The film presets are not here; the Film drawer lists them.
- [ ] Styles appended under the track's banner. Screenshots: the narration band over the harbour stand mid-shot; the drawer with the list.
- [ ] Commit: "Narrate the tour over the stage, and drive it from its drawer".

---

## Track O: the film

Branch `stage4/film`. Owns `apps/web/src/film/` (new), `apps/web/src/ui/Film.tsx` (replacing the trunk's stub), `apps/web/package.json` (one dependency), a section at the end of `styles.css`.

### Task O1: the stepped run

- [ ] `film/run.ts`: `renderFilm(options: { sequence: Sequence; fps: number; width: number; height: number; onFrame: (frame: number, total: number) => Promise<void>; signal: AbortSignal })`. It sets `useMotion.setClock('stepped')`, `play(sequence)`, then for each frame: `advance(1 / fps)` on the motion store, wait until `useView.getState().loading.size === 0` (a stand-in still streaming must not be caught half loaded), call R3F's `advance(frame * 1000 / fps)` (the `advance` off the R3F store, obtained through a `useThree` handle the `Film` UI stores on mount via a tiny `film/handle.ts` that `scene/Motion.tsx` does not know about: put a `<FilmHandle />` in your own `film/FilmHandle.tsx` and mount it from `ui/Film.tsx`... a DOM component cannot mount inside the Canvas, so instead export `setR3F(store)` from `film/handle.ts` and call it from a two-line `useEffect` you add to the trunk's `scene/Motion.tsx` at its top; report the lines), then `await onFrame(...)`. The dissolve in `fade.ts` uses `useFrame`'s delta, which R3F computes from the timestamps handed to `advance`, so the dissolve is deterministic. On finish or abort: `setClock('wall')`, `stop()`, restore the size (O2).
- [ ] Test the pure parts: the frame count for a sequence at a rate; the schedule of timestamps.
- [ ] Commit: "Step a sequence one frame at a time with everything loaded".

### Task O2: the size

- [ ] `film/size.ts`: the drawing buffer must be exactly `width` by `height` whatever the window is. The stage keeps its CSS size; the canvas's device pixel ratio is set through R3F's `setDpr` so that `cssWidth * dpr === width`, and the Canvas's aspect is forced by giving the stage a fixed-aspect box for the run (a class on `.stage` with `aspect-ratio` and centred; O's styles section). The composer follows the renderer's size on its own. Restore both after the run. Resolutions offered: 1920 by 1080, 2560 by 1440, 3840 by 2160; a 4k run on the 5070 Ti is expected to take a few seconds a frame with N8AO at full, which is fine for a film.
- [ ] Commit: "Draw a film frame at the size asked for, whatever the window is".

### Task O3: the encoder and the file

- [ ] `film/encode.ts`: WebCodecs `VideoEncoder` (`avc1.640033` for 1080p and 1440p, `avc1.640034` or `hev1` if the browser has it for 4k; `vp09.00.10.08` as the second choice) fed a `VideoFrame` from the canvas each frame, muxed with `mp4-muxer` (add to `apps/web/package.json`) into a `Blob` and saved with the File System Access API's `showSaveFilePicker` when present, else a download link. Where `VideoEncoder` is missing, the fallback writes PNGs (`canvas.toBlob`) into a directory from `showDirectoryPicker`, named `frame-000001.png`, and a `frames.txt` with the ffmpeg line to join them. Alongside either, an `.srt` of the shots' narration from their times, so a film of the tour carries its words.
- [ ] `ui/Film.tsx`: the drawer: a sequence picker over `SEQUENCES` (from Track N's `sequences.ts`; until N merges, import `TOUR` from `tour.ts` wrapped in a list and note it), resolution, fps (24 or 30), a Record button, progress ("frame 120 of 1440, 0:05 of 1:00"), Cancel. While recording the rail and instruments hide behind a `.is-filming` class on the shell (O's styles) so nothing in the DOM covers the canvas.
- [ ] Record "The rollback" at 1080p 24 fps (or the tour's first two shots if N is not merged); open the mp4 and check the dissolve and the epoch roll are in it. Commit: "Record a film from the viewer, frame by frame, to an mp4 or to frames".

---

## Track P: holding up under motion

Branch `stage4/steady`. Owns `apps/web/src/scene/Sky.tsx`, `scene/Water.tsx`, `scene/Standins.tsx` and `scene/Props.tsx` (LOD only), `scene/Vegetation.tsx` (fade and popping only), `scene/Atmosphere.ts` (dusk haze from low stands only).

### Task P1: the sun moving

- [ ] `Sky.tsx` rebuilds the PMREM environment on every `sun` change, and a tweened moment changes it twelve times a second. Measure the rebuild (`console.time` around `fromScene` at the current `SKY_SCALE`) and then: rebuild only when the sun has moved more than 0.5 degrees in altitude or 2 degrees in azimuth since the last build, or the state or the look anchors changed (look choices, named), and keep the fill and ambient lights updating every change since they are free. If a rebuild still costs more than 4 ms, halve the PMREM's source resolution during a sequence (`useMotion((s) => s.playing)` is the one motion read a scene file makes, and it is for cost, not for drawing) and restore it after. Prove it with the frame rate at the dawn stand while `useView.getState().setMoment({ hour })` is swept in a `requestAnimationFrame` loop from the console: before and after.
- [ ] Commit: "Rebuild the sky's reflections only when the sun has moved enough to show it".

### Task P2: no popping in a slow move

- [ ] `Standins.tsx` and `Props.tsx` swap LODs at a hard distance, which pops in a slow move. Add hysteresis: switch down at the distance and back up at 0.85 times it (a look choice), and swap only when the level has been on the other side of its line for at least two frames. `Vegetation.tsx`: check the grass and the scatter dissolve with `fade.ts` (instanced meshes carry a material; if the cards' alpha-tested material fights the hash, give it `alphaHash` off and a `fadeAlpha` uniform instead, and say so), and that the distance fade in the vertex shader does not shimmer when the camera moves slowly (use the camera's distance to the instance centre, not to its origin). Screenshots at two frames of a slow approach to the valley temple.
- [ ] Commit: "Swap detail with hysteresis and dissolve the vegetation with everything else".

### Task P3: dusk from low stands

- [ ] The open items from stage 3: the water reads milky at dusk from low stands (`Water.tsx` `LOOK`: mirror and mixStrength by the sun's altitude, less mirror below 5 degrees, and the reflection's blur up; the colour toward the sky's own dusk colour through the environment rather than a fixed green-blue) and the aerial haze reads heavy at low dusk views (`Atmosphere.ts`: the low dust layer's density by altitude is right at dawn but at the akhet moment it doubles up with the horizon's own brightness; scale it by the camera's height so a stand under 10 m sees two thirds of it). Compare the harbour stand at winter dusk and the akhet stand before and after, in `built` and `ancient`.
- [ ] Commit: "Clear the water and the air at dusk from the low stands".

---

## Merge order and verification (director)

1. Merge M (engine), then P (steady), then N (tour), then O (film). Resolve `App.tsx`, `store.ts` and the `styles.css` tail by hand; the trunk's `scene/Motion.tsx` is replaced by M's and then takes O's two handle lines.
2. Typecheck, test, build. Play the tour end to end on the wall clock in the browser; record "The rollback" at 1080p and the tour's first three shots; open both.
3. Snapshot 0031 with two stills from the tour and one frame of the film; deploy; docs and memory updated; the plan's boxes ticked.
