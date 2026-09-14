# Blender scripts

These run inside Blender's own Python and read `data/` directly. No add-ons
or packages are needed for the generator.

```
blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb
```

or open Blender, load `blender/generate.py` in the Text Editor, and press
Run Script. You get a `Seked` collection with, for each pyramid the preset
has a base and a height for, an "(as built)" object and a hidden "(today)"
object. The Great Pyramid's concavity is the `Concavity` shape key on the
"(as built)" object.

## The pyramid as it stands

There is one "(today)" object per pyramid, not two, and what it is made of
depends on what the preset carries:

- **Course by course** where the database has course heights. The Great
  Pyramid has 201 of them under every preset, Goyon's 1978 measurements on the
  north-east arris, so its "(today)" object is a stack of 201 square slabs
  standing 138.745 m in 1,608 vertices. Each course is full width from its bed
  to its top at the casing face line taken at its bed, so the steps hang on the
  same face the "(as built)" pyramid has. The casing's own thickness is not in
  the database course by course, so the slabs read a metre or so too wide, and
  the concavity is left off because it belongs to faces that are gone and is
  about the size of one step. The object's `seked_courses` and
  `seked_courses_source` say how many courses it is and whose.
- **A flat truncation** at `<id>.height.today` where the preset carries no
  courses, with the concavity as a shape key, which is what every "(today)"
  object used to be.
- **Nothing at all** where the preset carries neither. Khafre and Menkaure
  have no surviving height and no courses in the database, so they have no
  "(today)" object.

The stepped stack replaces the flat truncation rather than standing beside it:
they are two models of the same pyramid and the stepped one is the better,
so nothing downstream has to choose between them. The web viewer draws the
same stack from the same course records through `steppedPyramidMesh`, and a
parity test compares all 1,608 vertices and the enclosed volume between
`seked_data.py` and `@seked/geometry`.

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
generated objects is in the scene, that each pyramid's "(today)" object is
whichever of the three the preset calls for, and where it is the stepped stack
that it is eight vertices a course, names the courses and their source, and
stands exactly as high as its courses add up to, that each structure's
`Interior` collection
holds exactly the solids `interior_solids` builds for it under the preset
stamped on the objects, that the Sphinx's box is the size and in the place
`seked_data` puts it and says it is a placeholder, that the terrain object is
present and hidden and is the size its header says and the far ring is visible
and is the ring the two headers work out, that every object and every glTF node carries its
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

`--geometry` prints the eight-sided pyramid in each of its variants (as built
and truncated, flat and hollowed) as JSON; a test in packages/data compares
those vertices and volumes with `@seked/geometry`, so the two mesh builders
cannot drift. `--courses` below does the same for the stepped stack the
"(today)" object is actually built from.

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
`--ground` prints the flattened height at a fixed set of samples around two
literal pyramids; and `--courses` prints the stepped pyramid the generator
would stack for every structure the preset carries course heights for, with
its vertices, its faces, its volume and the height its courses add up to. All
five are checked against the TypeScript side by the parity tests. The file is
append-only, so they print after the resolved values: take the last line.

```
python3 blender/seked_data.py canonical --interior
python3 blender/seked_data.py canonical --courses
```

Not here yet: the shafts, the GPMP contours under the monuments, the Sphinx
as anything more than a box.

## Ground and renders

The generator writes three terrain objects. Two of them come from
`data/terrain/giza-glo30.f32`, the six kilometre grid at 20 m:
`Terrain (GLO-30 context)`, the surface model exactly as delivered and hidden
because its editing mask turns the monuments into smooth mounds, and
`Terrain (ground)`, the same grid with the ground under each pyramid set to
its surveyed base level within 40 m of the footprint and blended back into
the model over the next 260 m. The ground is a stand-in until the GPMP
contours are entered.

The third is `Terrain (far context)`, cut from `data/terrain/giza-glo30-far.f32`,
the same product resampled out to twelve kilometres at 60 m. It is a ring, not
a second surface: the faces the near grid already draws are left out, so the
two meet along the near grid's outer edge rather than lying on top of each
other, where they would z-fight. That only works because the far spacing is
three times the near one and the two origins are a whole number of far steps
apart, so the grids share their sample points; the generator checks both
before it builds anything. Nothing out there is flattened, since the pyramids
are all inside the near grid. `check.py` verifies all three, and derives the
ring's face count from the two headers rather than remembering it.

The flattening itself is `ground_height` in `seked_data.py`, which mirrors
`groundHeight` in `@seked/geometry`; a parity test pins the two to each other
on a fixed set of samples, so the .blend, the GLB and the web viewer cannot
disagree about where the ground is.

`render.py` renders a still headless, in Cycles, with the plan's materials
and one of four views. It needs the sky bake first:

```
pnpm sky-bake
blender -b build/seked.blend -P blender/render.py -- --view dawn    --out build/dawn.png    --width 1600 --height 900 --samples 128
blender -b build/seked.blend -P blender/render.py -- --view cutaway --out build/cutaway.png --width 1600 --height 900 --samples 128
blender -b build/seked.blend -P blender/render.py -- --view akhet   --out build/akhet.png   --width 1600 --height 900 --samples 128
blender -b build/seked.blend -P blender/render.py -- --view night   --out build/night.png   --width 1600 --height 900 --samples 128
```

Progress snapshots rendered this way live in `docs/progress/`.

### The sky bake

Nothing about the sun or the stars is computed in a Blender script, and
nothing about them is typed into one. `pnpm sky-bake` runs `scripts/sky-bake.ts`,
which asks `@seked/sky` and the canonical preset's observer (the Great
Pyramid's cited latitude and longitude) for four moments and writes
`build/sky-bake.json`:

| moment | epoch | what it is |
|---|---:|---|
| `equinox-sunrise` | −2499 | the vernal equinox sun's upper limb on the horizon, `sun.equinox.rise.azimuth` |
| `equinox-sunrise-plus-hour` | −2499 | the same sun an hour of hour angle later, from `sun.equinox.rise.lst + 15°` |
| `solstice-summer-sunset` | −2499 | C6's summer solstice sunset, `sun.solstice.summer.set.azimuth` |
| `alnitak-transit` | −2449 | Alnitak on the meridian, under the December solstice sun that season puts 37.7° below the horizon |

Each moment carries the epoch it was computed at and the name of the key or
the call its numbers came out of, so a figure in a render can be traced to
the function that produced it without opening a Blender file. A sun that is
up carries two altitudes: the geometric one, which is what a claim asserts,
and the refracted one from `apparentAltitude`, which is where the disc is
seen. At the standard sunset altitude those differ by 47′, which is the
difference between a picture with a sun in it and one without.

The `alnitak-transit` moment brings the whole bright catalogue with it: 8,920
stars to magnitude 6.5, precessed to the epoch with one shared matrix and
turned into altitude and azimuth at the sidereal time Alnitak transits at,
with each star's magnitude and colour index beside it. The render script
draws 4,441 of them, the ones above the horizon.

Without the file `render.py` prints a warning and falls back to the
placeholder angles in `VIEWS`, which are lighting and not astronomy.

### The four views

| view | moment | sun altitude, azimuth | what it shows |
|---|---|---:|---|
| `dawn` | equinox-sunrise-plus-hour | 12.129°, 97.122° | the three pyramids from the east-north-east, the light grazing the Great Pyramid's north face so its two halves separate |
| `cutaway` | equinox-sunrise-plus-hour | 12.129°, 97.122° | the same light, the casing at 15 % alpha, the passages and chambers in place inside it |
| `akhet` | solstice-summer-sunset | −0.833°, 298.523° | the solstice sun setting into the gap between Khufu and Khafre, seen from in front of the Sphinx: claim C6 as a photograph |
| `night` | alnitak-transit | −37.686°, 261.548° | the bright catalogue over the pyramids, Alnitak on the meridian and Orion standing over Khufu's apex |

Each view is a camera position, a target, a lens and an exposure in the
project frame, and the script prints all of them along with the sun it used
and where that sun came from. The akhet camera is taken off the Sphinx's own
box rather than written down, so it follows the cited coordinates: a bearing,
a distance and a height from the box's centre.

The sky is Blender's Sky Texture in its multiple-scattering model, which is
what 5.1 calls the half of Nishita worth rendering a low sun under, in dry
desert air: standard Rayleigh density, thin dust, and a subtropical ozone
column. Its `sun_rotation` needs no conversion at all. An equirectangular
probe of 5.1 puts the sun in +Y at rotation 0 and +X at rotation 90, and in
this project's frame +Y is north and +X is east, so the rotation is the
azimuth itself, measured from north through east.

The texture goes into the world twice, mixed on `Is Camera Ray`: with its sun
disc for what the camera sees, without it for what anything is lit by, and
the sun lamp is hidden from camera rays. So the sun is drawn once and
delivered once. The lamp's colour is Beer's law through Kasten and Young's
(1989) air mass with a Rayleigh optical depth per channel, which is what
turns the solstice sun to (1.000, 0.270, 0.009) at air mass 38 without anyone
choosing a colour, and its strength is the solar constant on the sky
texture's own measured scale. The drawn disc is at the texture's physical
radiance and comes out white with a warm surround, which is what a photograph
of a sun on the horizon does.

### Materials

Four materials, base colour and roughness and a bump and nothing else, as the
plan says. They are built in `render.py` so `generate.py` stays material-free,
and they are assigned by what an object is.

- **Tura casing**, on every "(as built)" pyramid: near white, smooth, with a
  large-scale noise in roughness so a face is not one flat plane.
- **Core limestone**, on the Sphinx's box and on any "(today)" object: warmer
  and coarser, banded into courses.
- **Aswan granite**, on the interior solids: dark red-brown with a fine grain.
- **Plateau sand**, on the terrain: pale, rough, drifting softly over tens of
  metres. The sky texture's ground albedo is the luminance of that same sand,
  so the two agree about what the plateau reflects.

The courses are the one number in the materials that comes out of the
database. A wave texture bands the object's own Z with a period of
`g1.height.original / 203`, which is 0.7221 m under the canonical preset: the
height is resolved through `seked_data` at render time and the 203 is the
number of courses Petrie counted (§26). Blender's banded wave runs its sine
over `20 · scale · z`, so the scale is `pi / (10 · course)`; that relation was
checked against 5.1 by rendering a wall of known height and counting bands.

### What is still a placeholder

- **The Sphinx is a box.** `generate.py` builds an axis-aligned massing box on
  a cited position and says so in its custom properties. In the akhet view it
  is the striped slab in the foreground, and it is half sunk, because its base
  is the Great Pyramid's base level while the ground model around it is
  higher: the real Sphinx sits in a quarried hollow the terrain does not have.
- **The courses are a mean, not the table.** Petrie measured all 203 course
  thicknesses and none of them is in `data/` yet. The real courses thin upward
  from about a metre and a half at the base and a few conspicuously thick ones
  interrupt the run; the bands here know none of that.
- **The night view's fill is not a light.** A moonless sky is not black and
  neither a sun 37° down nor the star dome will light a pyramid, so a flat,
  faint blue is added to the world to stand in for airglow. It is an exposure
  decision, and so is the compression of the star magnitudes from the physical
  0.4 exponent to 0.32: the catalogue spans a factor of four hundred in flux
  and a linear image exposed for Sirius would lose everything at magnitude 6.
  The positions are not compressed and not chosen.
- **The horizon past twelve kilometres is the sky texture's own ground.** The
  far ring carries the real heightfield out to twelve kilometres, which is
  past the horizon in the `dawn` and `cutaway` views and put an end to the dark
  band that used to show where the six kilometre grid stopped. Beyond the ring
  it is still the sky texture's ground, and no ground albedo fixes that; it is
  where the data stops.
- **Cycles runs on the CPU here.** This machine offers no GPU compute backend,
  so the four views at 1600 × 900 and 128 samples take between 12 s and 64 s
  each rather than the seconds a card would take.
