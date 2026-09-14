# Blender scripts

These run inside Blender's own Python and read `data/` directly. No add-ons
or packages are needed for the generator.

```
blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb
```

or open Blender, load `blender/generate.py` in the Text Editor, and press
Run Script. You get a `Seked` collection with, for each pyramid the preset
has a base and a height for, an "(as built)" object and a hidden "(today)"
object truncated at the surviving height. The Great Pyramid's concavity is
the `Concavity` shape key on both.

Inside it, an `Interior` child collection holds the Great Pyramid's passages
and chambers, one object per solid: the entrance passage, the three
subterranean pieces, the ascending passage, the passage to the Queen's
Chamber, the Queen's Chamber, the Grand Gallery, the Antechamber and the
King's Chamber. They are separate solids rather than a boolean cut out of the
masonry, so a section view is a matter of clipping them or hiding the whole
collection, and a claim overlay can name a point on one. A solid whose records
the preset does not carry is left out rather than guessed at.

`Terrain (GLO-30 context)` is the Copernicus heightfield as one grid in the
project frame, with the site's origin elevation from `data/sites.json` taken
off so z is height above the Great Pyramid's base. It is hidden by default and
says why in its `seked_note`: GLO-30 is a surface model whose editing mask
marks the monument footprints, so the pyramids arrive as smooth mounds and the
sample at the origin is neither the ground under Khufu nor the built surface
of Khufu.

Headless, the script starts from an empty file, so the saved .blend and the
GLB contain only the generated objects. In the Text Editor it adds the
collection to whatever is open.

Object custom properties record the preset and the source of the base and
height, and for an interior solid the records it was built from and their
sources, so the provenance travels with the .blend file and, as glTF extras,
with the GLB.

## Checking what was generated

```
blender -b build/seked.blend -P blender/check.py
```

`check.py` asserts the saved file and the GLB beside it: that nothing but
generated objects is in the scene, that the `Interior` collection holds
exactly the solids `interior_solids` builds for the preset stamped on the
objects, that the terrain object is present and hidden and is the size its
header says, that every object and every glTF node carries its provenance,
and that the `Concavity` shape keys survive the export as morph targets. It
prints one line per check and exits 1 on any failure. Pass
`-- --gltf <path>` if the GLB is not beside the .blend.

## The data reader

`seked_data.py` is the standard-library reader the generator uses. Running it
directly prints the resolved values for a preset; `--check` exercises the
geometry:

```
python3 blender/seked_data.py canonical --check
```

`--geometry` prints every mesh the generator would build (as built and today,
flat and hollowed) as JSON; a test in packages/data compares those vertices
and volumes with `@seked/geometry`, so the two mesh builders cannot drift.

`--shapes` does the same for the interior builders: it prints a fixed list of
literal passages, chambers and a corbelled gallery built by `extruded_section`,
`passage` and `chamber`, and the same parity test checks them against the
TypeScript builders. It reads nothing from `data/`, so it runs on its own:

```
python3 blender/seked_data.py --shapes
```

`--interior` prints the solids the generator actually builds for a preset,
each with the records it came from, and `--terrain` prints the heightfield's
identity and a fixed set of probes. Both are checked against the TypeScript
side by the parity tests. The file is append-only, so these two print after
the resolved values: take the last line.

```
python3 blender/seked_data.py canonical --interior
```

Not here yet: the shafts, the GPMP contours under the monuments, the Sphinx,
materials.
