"""
The claims' sky alignments drawn as their strongest case: C4's Orion over the three pyramids,
C5's lion facing its own constellation at the equinox dawn, C2's shafts reaching out to their
stars. render/alignments.py is the entry point; render/alignments.json holds the views.

Every star position comes from the sky bake (build/sky-bake.json, `pnpm run sky-bake`), every
number a caption states from the claims engine's own evaluation baked beside it; nothing here
computes where a star stood. `project` inverts a render's camera without Blender, so the
overlay (`compose`) draws each line exactly where the render put the star and the apex;
`scenes` is the Blender side, `lines` the constellation figures imported from Stellarium.
"""
