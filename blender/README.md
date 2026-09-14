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

Headless, the script starts from an empty file, so the saved .blend and the
GLB contain only the generated objects. In the Text Editor it adds the
collection to whatever is open.

Object custom properties record the preset and the source of the base and
height, so the provenance travels with the .blend file and, as glTF extras,
with the GLB.

`seked_data.py` is the standard-library reader the generator uses. Running it
directly prints the resolved values for a preset; `--check` exercises the
geometry:

```
python3 blender/seked_data.py canonical --check
```

`--geometry` prints every mesh the generator would build (as built and today,
flat and hollowed) as JSON; a test in packages/data compares those vertices
and volumes with `@seked/geometry`, so the two mesh builders cannot drift.

`--shapes` does the same for the interior solids: it prints a fixed list of
literal passages, chambers and a corbelled gallery built by `extruded_section`,
`passage` and `chamber`, and the same parity test checks them against the
TypeScript builders. It reads nothing from `data/`, so it runs on its own:

```
python3 blender/seked_data.py --shapes
```

Not here yet: terrain (BlenderGIS), interiors, the Sphinx, materials.
