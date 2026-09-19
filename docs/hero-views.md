# The hero views

Stewart ended the stage-by-stage cadence on 2026-09-19 and set this in its
place: a small number of locked stands, and quality driven only into what
those stands see. He is deciding whether the project continues on what comes
out of them, so this file is the record of what they are, what was found in
them, and what is known about making them beautiful.

The stands themselves are already written down, in `apps/web/src/looks.ts`,
and they are the same five `blender/render.py`'s `VIEWS` carries: **dawn**,
**panorama**, **harbour**, **akhet**, **night**. Nothing here invents a sixth.
The two files hold the same numbers in the project frame on purpose, so a look
in the viewer stands where the render stood, and a framing changed in one has
to be changed in the other or that stops being true.

## The rule these views are worked under

**A surface has to be authored for the distance it is seen from.** That is the
whole of what the first day found, and it is worth stating before the
particulars, because every fault below is a version of it.

The casing shader is a good shader. It draws the joints Petrie measured, at
the course heights the database carries, with a block tone and a polish tuned
twice against references. Every one of those terms is at the scale of a block:
a joint two centimetres wide, a course 0.7 m high, a block 1.7 m long. From
the dawn stand the Great Pyramid is about 760 m away and its face is some
400 px for 230 m of slope, so a pixel is roughly 0.6 m. The joints are faded
out by 340 m on purpose, because a line no pixel can hold only shimmers. The
block tone is a hash evaluated per fragment, so a pixel spanning many blocks
averages it away. The far sample in `stone.ts` was meant to be what is left,
but `sandy_gravel` was chosen for being fine and even, and a photograph with
no low-frequency content has nothing to enlarge.

Sum: a pyramid that rendered as two flat tones with a hard edge between them,
not because anything was broken, but because everything in it was built for a
camera standing somewhere else.

So the working band for a hero surface is set by the picture: **under about
5 m mips to an even tone, over about 20 m stops being surface and becomes a
gradient across the face.** A first try at 46 m lit the pyramid unevenly
instead of weathering it. Detail outside that band is not wasted, it is simply
not what these stands are paid for.

## What was found on 2026-09-19

**The casing had nothing on it at distance.** Fixed in 1561a6a by adding what
survives: three octaves of value noise in the pyramid's own frame inside the
band above, and a tone per group of courses hashed on the band index so the
change falls on a real course boundary. No assets, no models, one file. Every
number added is a look choice and the docstring says so; the course boundaries
the banding lands on are the database's own.

**The low sun drew a shadow nothing casts.** Fixed in 98faa64. The panorama
stand had a hard-edged wedge across the lower half of the Great Pyramid's
south face. A raycast from inside it towards the sun leaves the scene without
meeting geometry, and turning the shadow map off removes it, so it was not a
shadow of anything. It is the shadow camera running out: with the sun at
eleven degrees the light travels nearly horizontally, the cascade's depth axis
with it, and a pyramid is 230 m across and 146 m tall along that axis. Past
the fitted box the depth comparison has nothing to read and returns shadowed,
which is why the edge is dead straight and is the edge of a box rather than
the silhouette of a caster. `lightMargin` 400 to 1600, which clears the Great
Pyramid with the sun down to about six degrees, below every stand here. It
costs nothing measurable: the margin moves the near plane back and leaves the
fitted width, so texel density is unchanged.

**Light direction is doing more than any shader.** The same scene, same
assets, same renderer reads far better from the panorama stand than from the
dawn one, because the December sun rakes the south faces and leaves the east
ones in shadow. This is the largest single lever found so far and it costs
nothing at all.

**The air is not the problem.** Worth writing down because it looks as though
it should be. Over the panorama stand Khafre at about 1,500 m reads luma 170.7
against Khufu's 179.0 at about 900 m: eight luma for six hundred metres of
extra air. What flattens Khafre there is that the angle shows two lit faces
and no shadow face, which is composition. The haze was left alone.

## Two things that were not faults, and cost a morning between them

Both are written down so nobody spends the morning again.

**The net over the ground is a feature.** `Terrain.tsx` draws the raw GLO-30
context model as a wireframe over the flattened ground when the `ground` and
`terrain` layers are both on, deliberately, as the honest way to see how much
of the plateau has been moved. It is off in the tour and off by default. A
hero still wants `layers=pyramids,roofs,ground,sky` and no `terrain`.

**Two hypotheses about it were wrong and both were tested before being
believed.** Shadow acne, disproved by raising `normalBias` on all three
cascades and seeing nothing change; and the triplanar's screen-space
derivative normal in `stone.ts`, disproved by writing the fix and seeing
nothing change. Both were reverted. The lesson is the cheap one: the scene can
be asked what it contains, and asking took one call where guessing took
several.

## Taking a still

`?still=1` turns on `preserveDrawingBuffer`, `python scripts/still.py` listens
on 127.0.0.1:8787 and writes `build/stills/NAME.png`, and the page posts its
own canvas.

One addition, 2026-09-19, and it matters because it removes the thing that
blocked measurement: **`__seked.r3f().getState().advance(performance.now(),
true)` renders a frame on demand**, so a still can be taken without the window
being visible. `requestAnimationFrame` does not fire in a hidden pane, which
is why a capture there returns a blank or a stale buffer, and why
`__seked.r3f()` is null until something has forced a first paint. One
screenshot forces that paint; `advance` does the rest. The frame-rate work in
`scripts/frames.md` is blocked on the same thing and should be able to use it.

## Open, in the order they matter

1. **Composition.** The largest remaining gap and the one that wants
   Stewart's eye rather than a session's. The panorama stand puts the horizon
   near the middle and gives almost half the frame to empty ground. Moving in
   and up helps the scale and cropped Menkaure at the left edge, which is why
   nothing was committed: it is taste, and taste is his. Framings changed here
   have to move in `blender/render.py` too.
2. **Building-scale form.** The temples and the mastabas are footprints pushed
   up: sharp arrises, no batter on most, no cornice, no recessed doorway, one
   tiled surface. This is the same fault as the casing's, one level up, and it
   is the largest content item left.
3. **Per-structure variation in the mastaba field.** 577 tombs share one tone,
   so the field reads as a pale carpet. The casing's band hash is the pattern
   to copy; the field is one merged mesh, so it wants a per-tomb attribute at
   merge time rather than a world-space cell, which would cut tombs in half.
4. **A frame rate.** None has been taken since stage 6, and `built` and
   `ancient` have had the material table, the quay and the colonnade added
   since. `advance` above should unblock it.
