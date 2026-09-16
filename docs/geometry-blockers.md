# Resolving the missing geometry

Four pieces of the scene are still missing, and they have one thing in common.
None of them is missing for want of a source. Each is missing because its
geometry is drawn and not written: the text of every survey read so far states
the dimensions and leaves the arrangement to a plate. So the plan has two
halves. First a rule and a tool for taking figures off drawings without
breaking the project's rule that nothing is eyeballed. Then the four blockers,
each against the specific drawing that resolves it, all of which were checked
on 2026-09-16 and are named here with their archive.org identifiers.

## Part 1. Reading drawings honestly

The project forbids reading a position off a figure by eye, and it should keep
forbidding that. What it has never had is a way to use a drawing *properly*,
and there are two proper ways.

**Transcribed from a plate.** A dimension printed on the drawing ("21'8''", "3,45")
is text that happens to sit on a plate. It is entered exactly as a figure from a
table is: the value as printed, the plate number in the note, `verified: true`
once the transcription is checked against the image. This is no weaker than
anything already in the database.

**Scaled from a plate.** A distance measured off the drawing against its own
scale bar is a measurement with a known error, not a guess. It is entered with
`method: "scaled from plate"`, the plate and the scale bar named in the note,
and a sigma that is the sum of three honest terms: the pixel resolution of the
scan converted through the scale, the drafting tolerance of the original (half
a millimetre on the sheet unless the author states otherwise), and the paper
shrinkage of the scan (taken from how far the scale bar itself deviates from
its nominal length). It stays `verified: false`, because "verified" means
checked against a stated figure and a scaled figure has none. The dossier and
the viewer already mark unverified inputs, so a claim resting on a scaled
figure says so without any new machinery.

What remains forbidden is the thing the rule was written for: a coordinate
guessed from the look of a picture, with no scale, no sigma and no plate
reference.

### The tool

`scripts/plate.py`, standard library plus `pymupdf` (already installed; it
renders PDF pages without poppler, which is what stopped the Read tool):

1. `render`: one PDF page to a PNG at a stated DPI, cached under the
   scratchpad, never committed.
2. `grid`: the same page with a labelled pixel grid burned over a crop, so a
   point can be located to a few pixels by reading the grid rather than by
   estimating.
3. `scale`: given the two pixel ends of a scale bar and its printed length,
   the metres per pixel and the shrinkage against nominal.
4. `measure`: pixel points in, metres and the three-term sigma out, printed as
   a ready-to-paste measurement record.
5. `register`: control points in pixels and in the project frame, fitted with
   the same least-squares rotation and translation `scripts/footprints.ts`
   uses for OSM, residuals printed, for plans that are to be laid onto the
   plateau rather than measured within.

Each blocker below says which of the two methods it needs.

## Part 2. The four blockers

### 1. The well shaft and the grotto (Great Pyramid)

**Why it is blocked.** Petrie declines to measure it (section 46, "it is not
worth while to publish more complete measures than those of Prof. Smyth").
The Edgars (archive.org `Edgar-1910`) give only "about" figures in prose.

**What resolves it, in order of preference.**

- **Piazzi Smyth, *Life and Work at the Great Pyramid* (1867), vol. II.**
  Open, with a text layer: `lifeandworkatgr02smytgoog`, also
  `in.ernet.dli.2015.181325`. Petrie's own sentence says Smyth published the
  measures, so this is most likely **text, not a drawing**, and may resolve
  without Part 1 at all: the well's vertical and sloping legs, their lengths
  and angles, and the grotto's level.
- **Maragioglio and Rinaldi, Parte IV (the Great Pyramid).** Open, 33 MB with
  a text layer: `l-architectura-della-piramidi-menfite-parte-4`. Their
  sections of G1 carry the well. Transcribed where dimensioned.
- The Edgars' plates in `Edgar-1910` as a cross-check, scaled where Smyth and
  M&R are silent.

**How it is built.** The well is a bore that bends, which the shafts already
are: `bore()` takes an inlet and a list of legs with lengths and angles. The
inlet is Petrie's measured mouth (35.37 in from the Gallery's north wall on the
west ramp, section 46); the outlet is the descending passage, which is already
built. So the well becomes a fifth shaft, and like the shafts it has an
end-to-end check for free: its last leg must arrive at the descending
passage's floor, and how close it arrives is the test.

**Effort.** Small if Smyth has it in text. Start here.

### 2. Placing Menkaure's chambers (Third Pyramid)

**Why it is blocked.** Every dimension is already in the database, from
Petrie, M&R Parte VI's text and Vyse's appendix (all verified). Not one room
has a position, because the plan (which wall the large apartment's door is in,
which way the granite passage runs down to the sepulchral chamber) is never
stated in prose.

**What resolves it.**

- **Maragioglio and Rinaldi, *Tavole* 6,2 (1967)**, the plates volume for
  Parte VI. Open PDF, 92 MB: `Maragioglio_6-2`. The plan and sections of
  Menkaure's substructure, dimensioned.
- Perring's section in Vyse vol. II, "Sections of Apartments in the Third
  Pyramid" (plate at p. 81 of `operationscarrie02howa`), as a second reading.

**How it is built.** Mostly by transcription. What the plates add is topology
and a handful of offsets, and that needs one new mechanism in
`packages/geometry/src/interiors.ts`, designed but not built: a **route**. Each
passage and chamber that joins the one before carries `<member>.step` (its
order from the entrance), and a passage that turns carries `.direction` as an
azimuth, which the discovery already understands. A member with no stored
start begins at the previous member's exit; a chamber is entered on the wall
facing the arriving passage, at the offset along that wall the plate gives
(Petrie already recorded the doors "from the east wall", so several offsets are
in the database now). Numbers only, so it fits the schema, and it serves Khafre
as well as Menkaure.

**The check.** Vyse's chain distances are already entered and were never used
to build anything: 104 ft down the corridor, 4 ft 3 in to the anteroom, 13 ft 5
in to the end of the portcullises, 41 ft 3 in to the large apartment. The
route built from M&R's plates must reproduce them.

**Effort.** Medium. The route mechanism is the real work, and it has to be
mirrored in `blender/seked_data.py` with a parity test like every other builder.

### 3. Khafre's casing cap (Second Pyramid)

**Why it is blocked.** Petrie mentions "the present cap of casing" (section 68)
and observed its lowest corners in his triangulation (section 66), but prints
only their horizontal offsets, never their level.

**What resolves it.**

- **Maragioglio and Rinaldi, *Tavole* 5,2 (1966)**, the plates volume for
  Parte V. Open PDF, 73 MB: `Maragioglio_5-2`. Their elevation of Khafre shows
  where the surviving casing stops, and the Parte V text volume already in the
  database (`51maragioglio...1966lr`) may state the course number or level in
  words; read the text first.
- Petrie's plates in `cu31924012038927` for his triangulation stations.

**How it is built.** One record, `g2.casing.cap.lower_edge.up`, transcribed if
M&R state it, scaled off their elevation if they do not. The generator already
splits materials by height on a pyramid (Menkaure's granite courses,
`granite_casing_height`), so the cap is the same mechanism with casing above
the line and exposed core below it on the "(today)" object.

**Effort.** Small once the figure is found.

### 4. Heights for the mastabas (the cemetery fields)

**Why it is blocked.** The 577 mastabas are outlines from OSM with one
estimated height between them. Reisner tabulates his tombs by number, OSM
carries no numbers (three exceptions: G 2197, G 5110 and G 5170), and matching
the two needs his cemetery plans.

**What resolves it.**

- **Reisner, *A History of the Giza Necropolis* I (1942)**, with the cemetery
  plans and the tomb tables. On archive.org as `historyofgizanec0002reis`, but
  **lending-restricted**: it needs a signed-in account, which is yours to use,
  not this project's scripts'. Harvard's Digital Giza is expected to carry the
  same volume as a free download; that is unverified and is the first thing to
  check.
- The three tombs OSM does number are the registration's check points.

**How it is built.** Registration rather than measurement: lay each cemetery
plan onto the frame with `plate.py register`, using the corners of the Great
Pyramid and the queens' pyramids as control points, exactly as the OSM import
was fitted; then match each OSM outline to the Reisner number whose drawn tomb
contains its centroid, and take that tomb's height from his tables into a new
`mastaba.<number>.height` record. An outline with no match keeps
`tier3.mastaba.height`, so the field improves tomb by tomb and never regresses.

**The check.** G 2197, G 5110 and G 5170 must match themselves, and the
registration residuals must be reported like the OSM ones.

**Effort.** The largest of the four, and the one with a dependency outside the
project. Last.

## Order of work

1. **The well shaft**, from Smyth's text. Probably no drawing work at all, and
   it exercises the bore builder's end-to-end check.
2. **`scripts/plate.py`** and the two-method rule, written into CLAUDE.md's
   honesty rules beside "nothing is typed twice".
3. **Khafre's casing cap**, the smallest use of the new tool.
4. **Menkaure's chambers**, the route mechanism, checked against Vyse's chain.
5. **The mastabas**, after the Reisner volume is in hand.

## What is needed from Stewart

- Nothing for items 1 to 4.
- For item 5, either confirm that Digital Giza's copy of *A History of the
  Giza Necropolis* I downloads freely, or borrow the archive.org copy under
  your own account and drop the PDF in the scratchpad.
- A yes or no on the two-method rule in Part 1 before it goes into CLAUDE.md,
  since it loosens a rule the project was built on, if only slightly and only
  with a sigma attached.
