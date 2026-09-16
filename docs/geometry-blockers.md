# The next round

Two tracks: filling the four holes left in the geometry, and making the scene
beautiful. They meet in the middle, because a hole filled with a good model is
both.

The project's purpose was restated on 2026-09-16 and it sets the priorities
below. Seked is a test of how beautiful a fully Claude-driven scene of the
plateau can be, "as close to survey as we can get, with the holes filled in".
The pyramids, inside and out, stay as near survey as the sources allow,
because the claims are tested against them. Everything else needs its place
right, which the OpenStreetMap registration already gives to about a metre,
and may take a good free model fitted to its footprint.

## Part 1. Reading drawings (agreed)

Agreed 2026-09-16 and written into CLAUDE.md's honesty rules.

**Transcribed from a plate.** A dimension printed on a drawing is text on a
plate: entered as printed, the plate cited, `verified: true` once checked
against the image.

**Scaled from a plate.** A distance measured against the drawing's own scale
bar: `method: "scaled from plate"`, the plate and the bar named, a sigma that
sums the scan's pixel resolution through the scale, the drafting tolerance
(half a millimetre on the sheet unless the author states one), and the scan's
shrinkage (how far the scale bar deviates from its nominal length). Never
verified, because verified means checked against a stated figure.

Still forbidden: a coordinate guessed from the look of a picture.

### The tool to build first: `scripts/plate.py`

Built 2026-09-16. One finding from its first use: the Parte IV plates' page
sizes in the archive.org PDF are the sheets' true sizes, which is how Tav. 3
reads as 1:200 and Tav. 5 as 1:50 and how the drafting term is got.

Standard library plus `pymupdf`, which is installed and renders PDF pages
without poppler (the reason the Read tool could not show a PDF).

1. `render` a page to PNG at a stated DPI, cached outside the repo.
2. `grid` a crop with a labelled pixel grid burned in, so points are located
   by reading the grid.
3. `scale` from the two pixel ends of a scale bar and its printed length:
   metres per pixel, and shrinkage against nominal.
4. `measure` pixel points into metres with the three-term sigma, printed as a
   ready-to-paste record.
5. `register` a plan onto the frame from control points, with the same
   least-squares rotation and translation `scripts/footprints.ts` fits OSM with.

## Part 2. The four holes

All sources below were checked on 2026-09-16 and download without a login.

### 1. The well shaft and the grotto (Great Pyramid). Done 2026-09-16.

Smyth turned out to measure only the mouth, and the archive.org item named
below as Parte IV's text is its plates volume. The plates were enough:
`data/measurements/g1-well.json` holds the five legs as Maragioglio and
Rinaldi print them on Tav. 3 and Tav. 5, the two slopes they do not print
scaled with `scripts/plate.py`, and the outlet 7.62 m up the descending
passage. The last leg is solved onto that outlet and checked against the
plates' own 9.50 m at 75 deg: it comes out 9.72 m at 64.9 deg, a miss of
1.3 m in the section, inside what the scaled angles allow, plus 1.7 m east
to west that the section cannot show. What was planned:

Petrie declines to measure it (section 46) because Smyth already had, so the
source is **Smyth, *Life and Work at the Great Pyramid* (1867), vol. II**:
archive.org `lifeandworkatgr02smytgoog` or `in.ernet.dli.2015.181325`, both
with a text layer. This is probably text and needs no drawing work. Cross-check
against **Maragioglio and Rinaldi, Parte IV**: archive.org
`l-architectura-della-piramidi-menfite-parte-4` (33 MB, text layer), and the
Edgars' plates in `Edgar-1910`.

Built as a fifth bore with the existing `bore()`: inlet at Petrie's measured
mouth (35.37 in from the Gallery's north wall on the west ramp, section 46),
legs from Smyth. Its check comes free: the last leg must arrive on the
descending passage's floor.

### 2. Khafre's casing cap (Second Pyramid)

Done 2026-09-16, from text and not a plate. Maragioglio and Rinaldi's Parte V
text, p. 51, has the casing standing "per un'altezza di 40-45 metri a partire
dalla cima", and Perring's table in Vyse's Appendix, p. 117, has "from present
top to bottom of casing from 130 to 150 ft" and Khafre's present height, 447 ft
6 in. `g2.casing.cap.depth` and `g2.height.today` carry them (with Menkaure's
present height from p. 120), and `blender/render.py --state today` draws the
pyramids as they stand, Khafre's cap over his core. What was planned:

**Maragioglio and Rinaldi, *Tavole* 5,2 (1966)**: archive.org `Maragioglio_5-2`
(73 MB). Read the Parte V text volume already cited in the database first, in
case the course or level is stated in words; otherwise scale it off their
elevation. One record, `g2.casing.cap.lower_edge.up`, and the material split
by height the generator already does for Menkaure's granite. This is also a
visible win: Khafre's white cap over the stepped core is the silhouette people
recognise.

### 3. Placing Menkaure's chambers (Third Pyramid)

**Maragioglio and Rinaldi, *Tavole* 6,2 (1967)**: archive.org `Maragioglio_6-2`
(92 MB). Second reading: Perring's "Sections of Apartments in the Third
Pyramid" in Vyse vol. II (`operationscarrie02howa`, plate at p. 81). Reisner's
***Mycerinus* (1931)** is free from Harvard's Digital Giza (link below) for
the temples.

Needs one new mechanism in `packages/geometry/src/interiors.ts`, mirrored in
`blender/seked_data.py` with a parity test: a **route**. Each member carries
`<member>.step`, its order from the entrance; a passage that turns carries a
`.direction` azimuth, which discovery already reads; a member with no stored
start begins at the previous member's exit, and a chamber is entered on the
wall facing the arriving passage at the offset the plate gives (several such
door offsets, "from the east wall", are already recorded from Petrie).

The check: Vyse's chain distances, already entered and never used, must come
out of the built route (104 ft down the corridor, 4 ft 3 in to the anteroom,
13 ft 5 in to the end of the portcullises, 41 ft 3 in to the large apartment).

### 4. The mastabas. Downgraded.

Survey heights for 577 tombs are no longer worth chasing: they are not
pyramids, and their placement is already right. The plan now is a plausible
field rather than a surveyed one:

- **Reisner, *A History of the Giza Necropolis* I (1942)**, free from Harvard's
  Digital Giza (link below), gives typical core-mastaba proportions by
  cemetery. Use them to set a height per cemetery class, or to scale a height
  from each outline's footprint, as a labelled estimate.
- Give the mastabas real form in the visual track (a battered stone core with
  a stepped or cased face), instances of one or two good models fitted to
  each outline rather than extruded boxes.

## Part 3. The visual track

The standard is the one Stewart set: stunning, well textured, with light and
atmosphere worth looking at. In order of return on effort:

First pass done 2026-09-16: `blender/textures.json` names four CC0 Poly
Haven sets (core, casing, sand, gravel) and `python scripts/textures.py`
fetches them; `render_materials.py` box-projects them at two scales with block
tones and weathering, falling back to the procedural stone when they are not
fetched. `render_sky.build_atmosphere` adds a haze and a low dust layer, made
invisible to shadow rays so they do not dim the sun twice (shadow linking does
not reach volume attenuation in Blender 5.1). Still to do: displacement on the
stepped core, Aswan granite and basalt textures, and the mastabas.

1. **Materials.** Replace the flat procedural colours with PBR texture sets
   (base colour, roughness, normal, displacement) from CC0 libraries,
   **Poly Haven** and **ambientCG**, both downloadable by API without an
   account. Tura casing (fine white limestone), nummulitic core (coarse,
   pitted, with course lines and block joints), Aswan granite, basalt paving,
   and sand with wind ripples. Weathering by height and exposure. Displacement
   on the "(today)" core, where Petrie's measured courses already give the
   steps, so each course reads as blocks and not as slabs.
2. **Atmosphere.** Aerial perspective and haze so the far pyramids sit back in
   the air; a volumetric dust layer low over the sand at dawn and sunset;
   filmic tone mapping tuned per view. The physical sky and the baked sun are
   already right; this is what makes them look it.
3. **Stand-in models for everything that is not a pyramid**, from free
   sources, each fitted to its OSM footprint (centroid, principal axis for
   orientation, a scale check against the outline) and recorded in a
   `models/manifest.json` with URL, licence, attribution and the footprint it
   is fitted to. Candidates: the CC-BY photogrammetry scans of the Sphinx and
   the Great Pyramid already named in docs/plan.html (Sketchfab), and free
   temple and mastaba models. Sketchfab downloads need an account; if a model
   is wanted from there, Stewart downloads the file and it goes in the
   scratchpad.
4. **The sky.** The HYG stars are placed by the sky package and stay the
   measured layer. Add a Milky Way background from a public-domain
   equirectangular map (NASA's Deep Star Maps), rotated by the same precession
   the stars use so it cannot disagree with them.
5. **Hero renders and the film**, re-rendered at the end of each step above,
   logged in `docs/progress/log/`, with milestone snapshots in
   `docs/progress/`.
6. **The viewer**, fed the same textures through glTF with KTX2 compression
   (gltf-transform), as docs/plan.html always intended, so the browser is not
   the poor relation of the renders.

## Order of work

1. The hero film: finish it if the background render stopped (see memory),
   add it to docs/progress, `pnpm run deploy`.
2. The well shaft, from Smyth.
3. `scripts/plate.py`.
4. Khafre's casing cap.
5. Materials (visual 1) and atmosphere (visual 2), then a hero-render pass.
   The biggest visible gain in the project.
6. Menkaure's route.
7. Stand-in models (visual 3), mastaba form and heights (hole 4).
8. Milky Way, the viewer's textures, the film at full quality.

## Links

- Reisner, *A History of the Giza Necropolis* I, free, no login (262 MB):
  https://d1g9lvwdq3dcse.cloudfront.net/images/MFA-images/Giza/GizaImage/full/library/reisner_gn_books/giza_necropolis_1/giza_necropolis_1.pdf
  (listed at https://giza.fas.harvard.edu/pubdocs/128/full/)
- Reisner, *Mycerinus: The Temples of the Third Pyramid at Giza*, free, no
  login (179 MB):
  https://d1g9lvwdq3dcse.cloudfront.net/images/MFA-images/Giza/GizaImage/full/library/reisner_gn_books/mycerinus/reisner_mycerinus.pdf
  (listed at https://giza.fas.harvard.edu/pubdocs/130/full/)
- Maragioglio and Rinaldi: https://archive.org/details/Maragioglio_5-2 ,
  https://archive.org/details/Maragioglio_6-2 ,
  https://archive.org/details/l-architectura-della-piramidi-menfite-parte-4
- Smyth: https://archive.org/details/lifeandworkatgr02smytgoog

Nothing in this round needs anything from Stewart unless a Sketchfab model is
wanted.
