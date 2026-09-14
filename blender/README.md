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
height, so the provenance travels with the .blend file.

`seked_data.py` is the standard-library reader the generator uses. Running it
directly prints the resolved values for a preset; `--check` exercises the
geometry:

```
python3 blender/seked_data.py canonical --check
```

Not here yet: terrain (BlenderGIS), interiors, the Sphinx, materials.
