# The shot list

What is actually in frame at each stop of the walkthrough, how far away, and
therefore what band of detail it has to carry. This is the thing that turns
`docs/hero-views.md`'s rule, that a surface has to be authored for the
distance it is seen from, into a list of work.

Measured on 2026-09-19, not estimated. Every mesh in this scene carries
`userData.seked = { name, tier }` for the hover tag, so the scene can be asked
directly: step the tour to a shot, build the camera's frustum, and for every
tagged mesh whose world bounding sphere it intersects, report the distance and
the sphere's projected height in pixels at a 1600 by 900 drawing buffer.

Two things to read it with.

**These are opening framings.** A shot is a move, not a still: `tour.ts` gives
each one a camera track, and most travel a long way across their run. Shot 9
opens where shot 8 closed. So a structure's distance below is where the shot
*starts*, and the detail band it needs has to hold for the whole arc, not for
one frame.

**A merged field's pixel figure is the field, not a building.** The mastabas
are one merged mesh of 577 tombs and the city is sixteen batches, so their
`px` is the extent of the whole thing and means only "it fills the frame". The
distances are the number to read.

## What is in each shot

| # | Shot | State | Moment | Nearest things in frame, metres |
|---|------|-------|--------|--------------------------------|
| 1 | The plateau | today | equinox dawn | Sphinx enclosure 1203, mastabas 1326, Khafre's causeway 1290, G1 1613, G2 1605, G3 1653, city 1591, Nile 6661 |
| 2 | The ghost profile | built | equinox dawn | G1-b 545, boat pit slabs 577, causeway 733, G1 705, mastabas 1038, G2 1086, G2 enclosure 1098 |
| 3 | Three ghosts, one error band | built | equinox dawn | as shot 2, within a few metres |
| 4 | Inside the Great Pyramid | built | equinox dawn | **G1-a 84**, G1-b 115, **boat pit slabs 116**, **basalt pavement 117**, boat pit 138, **G1 245**, G2 673, G2 enclosure 676, mastabas 728 |
| 5 | The shafts and their stars | built | midnight | G2 enclosure 379, mastabas 504, G1 522, causeway 544, queens 602 and 621, boat pits 643 |
| 6 | The belt laid on the plateau | built | midnight | mastabas 1662, causeway 1682, quay 1667, harbour 1671, G2 1775, G2 enclosure 1830, G1 1850 |
| 7 | The gap and the solstice | built | June sunset | **harbour quay 167**, **harbour 171**, **Giza quay 187**, causeway 400, mastabas 630, G1 723, G2 enclosure 858 |
| 8 | Behind the Sphinx | ancient (lion) | June sunset | **causeway 102**, mastabas 256, **Sphinx 295**, Sphinx enclosure 297, Sphinx Temple 362, Wall of the Crow 634, flood plain 3381 |
| 9 | The rectangle on the ground | built | June sunset | opens on shot 8's stand and climbs to hold all three |
| 10 | The ghost Earth | built | June sunset | mastabas 1473, causeway 1488, quay 1507, G2 1554, G2 enclosure 1612, G1 1624 |
| 11 | Where the rest of it is | today | June sunset | G1-b 439, boat pit slabs 467, G1 599, causeway 654, mastabas 966, G2 995, G2 enclosure 1004 |

## What that adds up to

**The mastaba fields are in all eleven shots**, and as close as 256 m. Nothing
else in the exhibit is seen as often. They are 577 tombs merged into one mesh
sharing one tone, which is why the field reads as a pale carpet rather than a
cemetery. This is the highest-value content item in the project by a wide
margin, and it is not close.

**Khafre's causeway is in ten of the eleven**, from 1685 m down to **102 m**,
which is the nearest any structure comes to the camera except the queens'
pyramids. At 102 m a wall is read block by block.

**The Great Pyramid runs 245 m to 1850 m.** That whole range has to work,
which is what the weathering in 1561a6a was for; the near end of it now wants
the opposite treatment, because at 245 m the joints are inside their fade and
the blocks are what a reader looks at.

**The closest structure in the whole walkthrough is a queen's pyramid, at
84 m** (G1-a, shot 4), with the boat pit slabs and Khufu's basalt pavement
just behind it at 116 and 117. That is a surprise and it is worth saying: the
things the eye gets nearest to are not the famous ones, and `Queens.tsx` draws
them with `role={whole ? 'casing' : 'core'}` and nothing else.

**The Sphinx is only in two shots**, at 295 m. It has had more asset effort
than anything else in the project, several rounds of Meshy generation and a
retexturing pass, and it is on screen less than the boat pits.

## The bands, and what belongs in each

| Band | Distance | What it means | What is in it |
|------|----------|---------------|---------------|
| Near | under 150 m | Modelled form. Chamfered arrises, real openings, course-level relief, contact darkening. A tiled photograph will not do. | G1-a, G1-b, boat pit slabs, basalt pavement, Khafre's causeway at its closest, the harbour quay |
| Middle | 150 to 400 m | Wall-scale form and per-building variation. Batter, cornice, a recessed doorway, tone that differs building to building. | The Sphinx, Sphinx Temple, the Sphinx enclosure, the harbour, G1 at its nearest, the causeway through most of its range |
| Far | 400 m to 1 km | The weathering band of `hero-views.md`: features 5 to 20 m across, course-group banding, silhouette. | G1 and G2 through most shots, the enclosure walls, the mastaba field at its nearest |
| Distant | over 1 km | Silhouette and tone only. Nothing modelled here earns its place. | G3, the city, the Nile, the flood plain, everything in shots 6 and 10 |

## The order to work in

1. **Per-tomb variation in the mastaba field. Done 2026-09-20** (31d1060).
   A number per tomb is written at merge time and read in the shader, because
   a world-space cell is about the size of a tomb and would have cut tombs in
   half. It only reads at close range: driving the uniform from 0 to 0.45 on
   one frame of the Western Field at about 100 m moves the field's spread from
   29.45 to 30.70 and is plain to the eye, while the same change at the dawn
   stand, 1,300 m off, does nothing a measurement can find. That is the rule
   of this file working in the other direction, and it is why the first day of
   trying to tune this from the dawn stand found nothing.

   It also turned up the reason the field would not vary at all:
   `hashFraction` was FNV-1a with no avalanche, so ids differing in their last
   character came out 0.0039 apart, and every id here is a sequential OSM way
   id. `ruinFraction` reads the same hash, so the ruined mastabas had been
   standing at one height throughout.
2. **The queens' pyramids and the near furniture. Done 2026-09-20** (b468ee4).
   The boat pits had `strength: 0`, a flat tint with no photograph, so a
   rock-cut trench read as a dark hole; they take `bedrock` now, the same
   quarried face the Sphinx enclosure uses. The cased queens had joints but no
   block tone, so a dressed face read as a scored sheet.
3. **Khafre's causeway wants nothing from the material table.** Checked
   2026-09-20 and listed here so it is not done twice: the ramp, its walls and
   its roof all already carry a block tone and course joints, read off
   `data/materials.json` through `cased.ts`, as the valley temple does. The
   near band's material work is finished.
4. **Nothing for the Sphinx.** It is finished for what it is asked to do.

## What is actually left, and it is not materials

Every surface in the near band now has a photograph, a relief, a tone per
block and a joint at each course. What none of them has is **form**. The
causeway is a ribbon with flat walls and a flat lid; the mastabas are
footprints pushed up with one notch for a chapel; a queen's pyramid is a
cone of steps. At 84 to 150 m those read as clean boxes wearing good stone,
which is a different fault from the one this file started with and a dearer
one to fix: chamfered arrises, a cornice, a torus moulding, a doorway with a
depth to it, a broken course at a corner. That is modelling rather than
shading, it is the item `hero-views.md` already calls the largest content
gap, and the shot list is what makes it affordable, because it names the ten
or so buildings that have to have it rather than the six hundred that do not.

## One fault this measuring exposed

Not a distance question, but it was found while chasing one and it touches
everything drawn from our own geometry. `useStoneMaterial`'s effect depended
on the stone, the role and the options, none of which is the material, while
the components key their material on the timeline's state. Moving the timeline
therefore mounted a new material that never got `applyStone` at all, and it
kept its flat colour until something unrelated forced the effect. Going
`built` to `ancient` and back left the mastaba field's program cache key at
`air:v3`, with no stone in it. `built` to `stripped` never showed it, because
that transition also flips the role from casing to core and the role *was* a
dependency, which is most of why it survived this long. Fixed in b755833.

## A note on the shot mix

Eight of the eleven shots are claim diagrams read from dark, high, near
top-down stands with labels floating over the plateau; two or three are scenes.
An exhibit wants the opposite ratio, or at least a scene between each pair of
diagrams. That is a `tour.ts` question rather than a rendering one and it is
the largest single thing standing between this and the Antikythera
walkthrough, where every stop is a hero shot that happens to carry data.
