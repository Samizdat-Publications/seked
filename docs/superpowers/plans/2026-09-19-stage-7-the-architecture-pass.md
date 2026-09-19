# Stage 7: The architecture pass. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ancient states stop being pyramids standing among extruded
outlines. The temples, the causeways and the harbour front read as Fourth
Dynasty architecture, and every part of them either comes off a published plan
or says in its own label that it is a choice somebody made.

**Architecture:** parameterised builders in `@seked/geometry` beside
`templeMesh`, `templePlanMesh` and `enclosureWallMesh`, drawn by the
components that already draw those. No new pipeline, no new asset, no new
dependency. The one new kind of input is a plate read with `scripts/plate.py`,
which is the tool stage 2 built for exactly this.

**Spec:** `docs/superpowers/specs/2026-09-17-realtime-plateau-design.md` for the
look, CLAUDE.md for what may and may not be entered as a measurement.

---

## The thing to get right before anything is built

**Stewart's reference is a temple, but it is not one of these temples.** The
reconstruction he pointed at has fluted columns, a decorated facade and a
cavetto cornice. Those are real Egyptian architecture and they are the wrong
architecture for this plateau: fluting, palmiform capitals, cavetto cornices
and carved facades are of later dynasties and other sites. Giza's Fourth
Dynasty temples are the most austere building Egypt ever did. Khafre's valley
temple is the one that survives to its roof and it is plain: megalithic core
blocks, a red granite casing, **square monolithic piers with no base and no
capital**, a flat roof, an alabaster floor, and not one carved surface in the
whole hall. Its doorways are plain rectangular openings.

So this stage does not copy the reference. It builds what is there, and the
list below is what "there" means. Putting a fluted column on Khafre's valley
temple would be a step away from the survey dressed up as a step toward
beauty, and that is the one trade this project does not make. The reference's
real lesson is the other half of it: mass, shadow, a doorway that reads as a
way in, and a causeway that arrives somewhere.

**What is already done** (2026-09-19, before this plan): the walls are
battered, 82 degrees outside and vertical inside, with the slab on the wall
head rather than out past it. `TEMPLE_BATTER_DEG` in `temple.ts`, a look
choice against Reisner's surveyed 74.8 degrees for the mastabas.

## Global Constraints

Everything in the stage 1 to 6 plans holds: no em dashes; nothing typed twice;
metres and degrees; the data frame under the one rotated group; commit named
paths; `pnpm typecheck` and `pnpm test` before every commit;
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; own branch in own
worktree; `scripts/frames.md` for any frame rate, including its rule that a
number at the display's refresh is a ceiling and not a rate, and that nothing
is measured while one of this repo's own jobs is running. Claim the repo with
`python scripts/job.py claim <session>` before the trunk.

New for this stage:

- **A shape read off a plate is a measurement and goes in `data/`.** A shape
  nobody has read off a plate is a look choice, lives as a named constant in
  the builder, and is named in the label the viewer shows, exactly as
  `WALL_THICKNESS`, `PILLAR` and `TEMPLE_BATTER_DEG` are now.
- **No ornament without a source.** No cornice, no fluting, no carved facade,
  no colour on a wall, unless a cited plate shows it on that building.
- **The austerity is the look.** If a temple reads as dull, the answer is
  light, shadow, material and scale, not decoration.

---

## The trunk (director, before the tracks branch)

- [x] `docs/geometry-blockers.md`: folded into "Order of work", the batter
      marked done, and the night's two findings written up there.
- [x] `data/sources.json`: Hoelscher 1912 and Reisner GN I were already
      there; Reisner's *Mycerinus* is now `reisner-1931`, with the MFA URL,
      the page offset and the list of plans in its note.
- [x] Commit 5938982.

---

## Track A: the way in

A building with no door is a box. Every temple on the plateau has one axis and
one principal doorway, and the causeway says which side it is on.

- [x] `walledMesh` in `temple.ts`: `annulusMesh` with rectangular openings cut
      through it, jambs square to the wall and leaning with its batter, head
      flat. `DOORWAY` is three metres by five and is named in the label.
- [x] The side is not chosen per building and does not need to be: every
      temple on this plateau opens east, so the door is in the edge whose
      middle faces east, by `edgeFacing`. A wall too short to carry a door
      without becoming a gap between two stubs gets none, and the label says
      so.
- [x] Tests: `meshVolume` says the hole is exactly its width by its head by
      the wall's thickness (this caught a splayed embrasure), the triangles
      are walked to insist the solid is still closed (this caught a T-junction
      at every corner), the jambs follow the batter, a ruin has no door, and
      with no openings the wall equals `annulusMesh` vertex for vertex.
- [x] Commit 10ec9a5, with a still east of Khafre's mortuary temple.
- [ ] Khafre's valley temple has TWO doorways in its east face and Hoelscher's
      plate can say where: that is Track E's, not this one's. Still open; the
      blockers doc records where on the plate the night got to.

## Track B: the material each building is cased in

- [x] `data/materials.json`, seventeen rows over six buildings, each citing a
      source that exists and none verified. Khafre's valley temple red granite
      on Giza limestone with an alabaster floor from Blatt XVII's own
      Zeichenerklaerung; the mortuary temples limestone with granite at the
      doorways; the causeway limestone. Menkaure's two are crude brick over
      limestone, which the plan did not anticipate and Reisner's table of
      periods (p. 7) requires.
- [x] Nothing about the casing thickness is invented: the table has no
      thickness in it and `MaterialSchema` has no field for one.
- [x] Commit 671eff0, still `0034-viewer-red-granite.png`. It also caught the
      triplanar laying every east and west face's photograph on its side.

## Track C: the causeway as a corridor

`causewayRoofMesh` already carries a slab over the ramp. A causeway is a
roofed corridor with walls, and Unas' is lit by a slit down the middle of the
roof, which is the detail that makes it read.

- [x] Walls either side of the causeway's own plan, to
      `tier3.causeway.corridor.height`. Built on the ribbon's own outline
      drawn in by `CAUSEWAY_WALL_THICKNESS`, climbing with its per-vertex
      bases so a wall follows the ridge the causeway follows. Not battered:
      the causeway's outline is the import's buffered polyline and a batter on
      it would lean the corridor's walls by a number nobody chose, where the
      temples' batter at least answers a surveyed mastaba.
- [x] `CAUSEWAY_ROOF_SLIT.on` is false, with the sentence, and the roof's own
      label says the slit exists and why it is not drawn. Commit d15dd9d.
- [x] The ends are left open, found rather than named: the two edges whose
      middles stand farthest apart are the ribbon's end caps.
- [x] Tests, commit, a still looking up the causeway toward Khafre.

## Track D: the harbour front

- [x] `quayMesh` in `@seked/geometry`, on the level `waterExtent` reads off
      the temples' footprints, two metres of freeboard, three metres thick,
      battered 84 degrees on its seaward face and upright behind.
- [x] They never meet: the causeway ends at the back of the valley temple and
      the quay stands on its far side. What is asserted is that neither runs
      through the other, and that the quay clears both temples, which the
      basin's own west edge did not.
- [x] Commit 925fb4d, still `0034-viewer-the-architecture-pass.png`.

## Track E: the plans nobody has read yet

The plate reader exists and has been used twice. These are the drawings that
would turn look choices into records.

- [ ] Reisner, *Mycerinus*: Menkaure's valley and mortuary temples in plan and
      section. The PDF URL is in `docs/geometry-blockers.md`.
- [ ] Hoelscher 1912, the rest of Blatt XVII: the twenty-three statue sockets
      and the east entrances of Khafre's valley temple hall, which stage 3
      left open.
- [ ] Every figure through `scripts/plate.py` with its three-term sigma,
      `method: "scaled from plate"`, never `verified`.
- [ ] Commit per temple, not per figure.

## Track F: the court

- [x] `courtColonnadeMesh` walks the court's outline and sets a pillar every
      step along it. The grid stays, and the test asserts the difference
      against it rather than against a property of one ring.
- [x] Inset by `PILLAR.pitch` itself, so no second constant was invented.
- [x] Commit 8de6e53, and a temple-roofs layer to hide them by. Still
      `0034-viewer-court-and-colonnade.png`.

---

## Done when

- [x] Snapshot 0034.
- [x] Every one, through `stoneNote` and `lookWords` for the materials and
      each builder's own label for the rest.
- [ ] NOT DONE, and not guessed at. `scripts/frames.md` wants a visible
      window in front; this session drove a hidden browser pane, where
      `requestAnimationFrame` does not fire and `__seked.frames` never
      resolves. It was tried and it hung, which is the rule working.
- [x] Snapshot 0034 logged, four frames in `docs/progress/log/`, deployed.
