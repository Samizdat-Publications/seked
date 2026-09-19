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

- [ ] `docs/geometry-blockers.md`: fold this plan's list into "Order of work"
      and mark the batter done.
- [ ] `data/sources.json`: entries for Hoelscher 1912 (already there, check
      the plates cited), Reisner's *Mycerinus* and Reisner GN I, with the
      Heidelberg and MFA URLs already in the blockers doc.
- [ ] Commit: "Give the architecture pass its sources".

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
      plate can say where: that is Track E's, not this one's.

## Track B: the material each building is cased in

- [ ] Khafre's valley temple is red granite, the mortuary temples limestone
      with granite at the doorways, the causeway limestone. `Structures/` can
      already take a material per structure; this is a table and its sources.
- [ ] Nothing about the casing thickness is invented: it is a material, not a
      geometry, until a plate gives a thickness.
- [ ] Commit, then a still.

## Track C: the causeway as a corridor

`causewayRoofMesh` already carries a slab over the ramp. A causeway is a
roofed corridor with walls, and Unas' is lit by a slit down the middle of the
roof, which is the detail that makes it read.

- [ ] Walls either side of the causeway's own plan, battered like the
      temples', to `tier3.causeway.corridor.height`.
- [ ] The roof slit as a look choice, off by default until somebody decides
      whether a Fourth Dynasty causeway had one: Unas is Fifth Dynasty and
      Sahure's is the nearest evidence. This is exactly the kind of borrowing
      the top of this plan warns about, so it is a switch with a sentence and
      not a default.
- [ ] Tests, commit, a still looking up the causeway from the valley temple.

## Track D: the harbour front

- [ ] A quay along the harbour cut, on the water's own level from
      `Water.tsx`, with a stated height and batter.
- [ ] Where the causeway meets it, the two agree in plan.
- [ ] Tests, commit, a still from the harbour stand.

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

- [ ] A mortuary temple's open court with its colonnade round the edge rather
      than a grid of pillars across the whole inside, which is what
      `colonnadeMesh` does now and what makes the interiors read as a car park
      when the roof is off.
- [ ] The pillars stand on the court's own perimeter, inset by one pitch.
- [ ] Tests, commit, a still with the roof hidden.

---

## Done when

- [ ] A reader at the harbour stand can see a doorway, a roofed causeway
      arriving at it, and a quay on the water.
- [ ] Every new shape is either in `data/` with a plate behind it or named in
      a label as a choice.
- [ ] `built` and `ancient` still clear their bars in `scripts/frames.md`'s
      terms.
- [ ] A snapshot logged and the site deployed.
