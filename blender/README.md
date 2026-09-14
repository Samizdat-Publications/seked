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

Inside it, each pyramid whose interior the preset carries records for gets a
child collection of its own: `Interior` for the Great Pyramid, and
`Interior (G2 Khafre)` or `Interior (G3 Menkaure)` for the others. The Great
Pyramid's holds one object per solid: the entrance passage, the three
subterranean pieces, the ascending passage, the passage to the Queen's
Chamber, the Queen's Chamber, the Grand Gallery, the Antechamber and the
King's Chamber. They are separate solids rather than a boolean cut out of the
masonry, so a section view is a matter of clipping them or hiding the whole
collection, and a claim overlay can name a point on one. A solid whose records
the preset does not carry is left out rather than guessed at, and a structure
with no interior records at all gets no collection.

Nothing in the generator knows what Khafre's or Menkaure's plan looks like.
G1's rooms are named one by one in `interior_solids` because Petrie stores each
of them differently; every other structure is read out of its own records,
which all begin with its id:

```
g2.passage.<name>.floor.begin.{north,east,up}   floor centre line
g2.passage.<name>.floor.end.{north,east,up}
g2.passage.<name>.{width,height}                rectangular section
g2.passage.<name>.angle                         optional, provenance only

g2.chamber.<name>.wall.{north,south}.north      wall positions
g2.chamber.<name>.wall.{east,west}.east
g2.chamber.<name>.{floor,ceiling}.up            levels
g2.chamber.<name>.gable.height                  optional pitched roof
```

A chamber's three extents are each read on their own, because a survey records
what it could reach. East to west is both side walls if both were located, else
one of them and the chamber's `length` (whole, or the mean of `length.north`
and `length.south` as Petrie measures it), else `centre` and that length; north
to south is the same with the two end walls and `width`. The vertical is
`floor.up` with either `ceiling.up` or `wall.height`. A wall bounds its own
side, so a length hung off `wall.west.east` runs east and one hung off
`wall.east.east` runs west.

A north coordinate may be recorded instead as `<point>.from_north_base`, a
distance south of the north base edge, and an east one as
`<point>.from_east_side`, a distance west of the east base edge; both are
converted with the structure's half-base. A passage with no `floor.begin` of
its own starts at the structure's entrance, `g2.entrance.<name>.floor.begin` if
one is named for it and `g2.entrance.floor.begin` for the descending passage,
which is how G1's entrance passage is stored. Anything incomplete is skipped.
Interiors are built in their own structure's frame and placed with the same
centre offsets, base elevation and orientation as the pyramid objects.

As entered today, G2's and G3's sheets are dimension sheets: Petrie gives the
lengths, widths and heights but not a position in the pyramid's frame, so every
one of their rooms is skipped. G2's great chamber is the closest: it has its
lengths, its widths, its wall and gable heights and a located west wall, and
wants only a north position and a `floor.up` to build.

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
generated objects is in the scene, that each structure's `Interior` collection
holds exactly the solids `interior_solids` builds for it under the preset
stamped on the objects, that the Sphinx's box is the size and in the place
`seked_data` puts it and says it is a placeholder, that the terrain object is
present and hidden and is the size its header says, that every object and every glTF node carries its
provenance, and that the `Concavity` shape keys survive the export as morph
targets. It
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

`--interior` prints the solids the generator actually builds for a preset, one
entry per structure that has any, each solid with the records it came from;
`--interior-case` prints the same for an invented prefixed pyramid, so the
discovery can be compared with the TypeScript one before G2's or G3's records
exist; `--terrain` prints the heightfield's identity and a fixed set of probes;
and `--ground` prints the flattened height at a fixed set of samples around two
literal pyramids. All four are checked against the TypeScript side by the
parity tests. The file is append-only, so they print after the resolved values:
take the last line.

```
python3 blender/seked_data.py canonical --interior
```

Not here yet: the shafts, the GPMP contours under the monuments, the Sphinx,
materials.

## Ground and renders

The generator writes two terrain grids from `data/terrain/giza-glo30.f32`:
`Terrain (GLO-30 context)`, the surface model exactly as delivered and hidden
because its editing mask turns the monuments into smooth mounds, and
`Terrain (ground)`, the same grid with the ground under each pyramid set to
its surveyed base level within 40 m of the footprint and blended back into
the model over the next 260 m. The ground is a stand-in until the GPMP
contours are entered; `check.py` verifies both grids.

The flattening itself is `ground_height` in `seked_data.py`, which mirrors
`groundHeight` in `@seked/geometry`; a parity test pins the two to each other
on a fixed set of samples, so the .blend, the GLB and the web viewer cannot
disagree about where the ground is.

`render.py` renders a still headless, with the plan's materials and the
first hero view (equinox dawn from the north-east, sun 6 degrees up in the
east):

```
blender -b build/seked.blend -P blender/render.py -- --out build/hero.png --width 1600 --height 900 --samples 64
```

Progress snapshots rendered this way live in `docs/progress/`.
