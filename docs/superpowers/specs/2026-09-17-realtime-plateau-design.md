# The realtime plateau: design

Written 2026-09-17 by the Fable session seked-e9, with Stewart's editorial
brief of the same day and full editorial control delegated to it. This is the
design the next stages build to. `docs/handoff-2026-09-17.md` is the factual
state it starts from; `docs/geometry-blockers.md` keeps the history.

## 1. What we are making

A fully 3D, realtime, as-beautiful-as-we-can-make-it Giza plateau in the web
viewer at https://seked.pages.dev, in four states along one timeline, with
the sky of any epoch over it, and with every claim still testable against the
survey geometry underneath. The Blender renders proved the look. The viewer
carries it from here, and Blender becomes the asset baker rather than the
place the picture lives.

Stewart's brief, in his words, condensed:

- Make it look amazing. Models for everything on the plateau, downloaded or
  generated. Creative licence is fine for anything that is not a pyramid,
  because no record says what stood where that far back.
- The oldest state should read as a shimmering, almost advanced society with
  the aesthetic of giant megalithic construction: the pyramids with their
  glass-like polished casing and an exotic capstone, a civilisation more
  advanced than we assume, using the Earth's own properties rather than
  visible technology. Not science fiction, not ancient aliens: a
  pre-cataclysm civilisation whose works were later inherited and claimed by
  the people who settled among them.
- The interface is not liked and gets redesigned now.
- Meshy credits are limited (450). Decide what is generated, what is
  downloaded and what is built from our own data.

## 2. The four states, one timeline

The viewer's `state` becomes a timeline with four stops. Each is a whole look
for every structure, the ground and the sky's default moment. The epoch of
the sky stays an independent choice, as before, but each state carries the
epoch it defaults to.

| id | Caption | Default epoch | What it asserts |
|---|---|---|---|
| `ancient` | The First Time (a claim) | 10,500 BCE | The lost-civilisation reading: the plateau whole and new, the Sphinx a black Anubis, the Sahara green. Labelled a claim throughout. |
| `built` | As built | 2450 BCE | The mainstream reconstruction: cased pyramids, complexes whole, the Sphinx as carved. Labelled a reconstruction. |
| `stripped` | Stripped and buried | 1500 CE | Casing quarried away, the Sphinx buried to the neck, temples under sand. A reconstruction of a documented condition (the early travellers' Giza). |
| `today` | As it stands | 2026 | The survey: stepped cores, Khafre's cap, the excavated Sphinx, the mastaba fields as ruins. |

Moving the timeline cross-fades between neighbouring states over about a
second: materials blend, stand-ins fade, the sand level moves. The state is
in the URL like everything else.

**Honesty stays visible.** Every view carries a caption line naming the
state and what kind of thing the reader is looking at: survey, reconstruction
or claim. Hovering a structure names it, its evidence tier and its source or
stand-in note. Nothing in this design promotes a tier.

## 3. The look of each state

### 3.1 The First Time (`ancient`)

The principle is that the tell of an advanced builder is precision, scale and
material, never a device. Nothing glows that a physicist could not explain
with light on a surface, with one restrained exception noted below.

1. **Precision.** The casing is polished Tura limestone: mirror-flat faces
   with joints too fine to see, a clearcoat sheen, and the sky reflected in
   them at grazing angles. Face-on they read as pale matte stone; from a low
   sun they read as glass. This is Fresnel on a polished surface and it is
   the single strongest cue.
2. **The capstones.** Electrum pyramidions (the gold-silver alloy the
   Egyptians actually used), sized to each apex from the database's slope so
   they cannot disagree with the angle. They catch the sun before the plain
   is lit at dawn and after it has fallen into shadow at dusk, because they
   stand 146 m up; that is real geometry and it is the shimmering moment.
3. **The one exception.** At night in the ancient state the apexes carry a
   faint corona, a few percent emissive with a slow flicker, like St Elmo's
   fire. It is the only nod to the pyramids-as-machines reading, it is
   labelled as a claim in the caption, and it is off in every other state.
4. **Water.** The harbour basin full and reflecting; a canal running east
   toward the Nile; reflecting pools in the temple forecourts. Water is the
   biggest realtime beauty multiplier and the harbour is mainstream
   archaeology (Lehner). The wider water is the claim's staging.
5. **The Green Sahara.** In 10,500 BCE North Africa was entering the African
   Humid Period, which is science and not a claim. The plateau's margins carry
   grass and scrub, acacia and date palms along the water, and the desert
   beyond is savanna under a sky with clouds. `built` is drying and sparse;
   `stripped` and `today` are bare.
6. **Cyclopean masonry.** The temples are built of megalithic blocks with
   tight polygonal joints, red granite cladding and monolithic granite
   pillars. Khafre's valley temple really has core blocks over 100 tons, so
   this is the mainstream fact pushed to the front, not invented.
7. **Black, white, gold, lapis.** The palette: white casing, black basalt
   pavements and the black Anubis, electrum and gold leaf, lapis accents on
   the collars and door frames, red granite, green and water.
8. **No litter.** No sand drifts, no ruins, no roads, no scaffolding. The
   processional ways paved in polished basalt (Khufu's basalt pavement is
   surveyed).
9. **The default moment** is the December sun an hour before it sets, the
   view the Blender panorama proved; the second is equinox dawn.

Everything above that is not survey is labelled a claim in the caption. The
Anubis stays as chosen on 2026-09-17: matt black with metallic gold leaf.

### 3.2 As built (`built`)

The mainstream reconstruction, c. 2450 BCE: cased pyramids with plain stone
pyramidions (a gilded variant switchable as `claimed`), complexes whole,
causeways roofed, enclosure walls, the queens' pyramids cased, the mastabas
cased with their chapels, the Sphinx as carved and painted in its trench with
the Sphinx Temple in front, the harbour at the valley temples. Dry ground with
sparse scrub. Every part a reconstruction and said to be.

### 3.3 Stripped and buried (`stripped`)

Roughly the Giza of 1500 CE: the cores bare (Khafre's cap remains), the
Sphinx buried to the neck, the temples and the Sphinx Temple under sand, the
mastaba fields low mounds. Sand is a level per structure, drawn as a raised
ground patch. Its purpose is to show the steps between built and today,
which Stewart asked for.

### 3.4 As it stands (`today`)

The survey as now: stepped cores from Petrie's courses, Khafre's cap, the
excavated Sphinx with its scaffolding (the generated model has it), the
mastabas as battered ruins, the enclosure cleared, the temples as low walls.
A faint brown haze band on the eastern horizon stands for Cairo.

### 3.5 The Sphinx sequence

The in-between Sphinxes Stewart asked for come free from the models already
generated, and cost no credits: `ancient` shows the fresh black Anubis;
`built` the carved and painted Sphinx (the mainstream), or with the claim
switched on, the weathered Anubis recut; `stripped` the weathered human head
buried to the neck; `today` the excavated Sphinx. The lion stays a switchable
claim in every state, as agreed.

## 4. Where the assets come from

The rule: **architecture is built from our own data; sculpture is generated
or downloaded.** Rectilinear things are cheap to build, honest to place, tiny
to download and consistent across states. Sculpture is not.

### 4.1 Built procedurally (no credits, no download)

- The three pyramids, cased and stepped, with course joints and pyramidions
  (already in `@seked/geometry`; the pyramidion builder is new).
- The eight queens' and satellite pyramids from their footprints and the
  database's slopes, cased in `built` and `ancient`, stepped ruins in
  `stripped` and `today`.
- The 577 mastabas: a battered core with courses (Reisner's batter and
  course height, already recorded), cased with chapels in the early states,
  ruined in the late ones. Instanced.
- The six temples: from their footprints, walls carried to
  `tier3.temple.height`, roofed in the early states, with cyclopean block
  patterning, granite cladding and a colonnade generated inside the
  footprint. Ruined to low walls in the late states.
- Khafre's causeway roofed; the Wall of the Crow as courses of megalithic
  blocks; the enclosure walls of each pyramid from the recorded distances.
- The Sphinx enclosure as a trench cut into modelled bedrock, its outline
  taken from a published plan and scaled with `scripts/plate.py`, which also
  fixes the mismatch seked-6c reported (the render's box cutter against the
  reconstruction's freestanding walls).
- The harbour basin and canal as a water surface on a cut in the ground.
- Vegetation instances (palms, scrub, grass cards) placed by rules on the
  ground by state.

### 4.2 Downloaded

- Poly Haven CC0 models through the API already used for textures: date
  palm, scrub, rocks and boulders.
- Sketchfab scans, through the token already in `~/.seked/keys.env`, chosen
  on quality alone: a seated Khafre or another Fourth Dynasty royal statue
  scan for the valley temple, Khufu's solar boat, a recumbent jackal.
- The L.VII.C whole-plateau reconstruction stays as the placement reference
  and as a stopgap for `built` until the procedural temples land; it is
  baked to GLB parts by group through the same pipeline as the stand-ins.

### 4.3 Generated with Meshy (about 35 a model, 10 a retexture)

What no scan gives and no builder can make. The balance (450 on 2026-09-17)
is not a ceiling: Stewart said the same day that he will buy credits when a
generation is worth it, so the table below is the first spend and not the
limit. A real scan still comes first where one exists, because it is a real
object and not a guess.

| Item | Credits | Why |
|---|---|---|
| A seated king for the valley temple's 23 emplacements, if no scan is good enough | 35 | Sculpture that repeats, so one model instances 23 times |
| A guardian jackal pair for the ancient temple doors, if no scan is good enough | 35 | The Anubis theme carried into the architecture |
| Retakes of either | 70 | Last night's rate was three tries a model |
| Whatever the first renders show is missing | as needed | Stewart tops up the balance on request |

The Sphinx variants need no new generation. Every generation is logged in
`blender/models.json` as now.

## 5. Architecture

### 5.1 Two renderers, one baker

- **Blender** keeps the hero stills and the film, and gains
  `blender/export_web.py`: for each stand-in and reconstruction part, do the
  fit `render_standins.py` already does, then export a GLB in the project
  frame with its materials and finish, at three decimation levels. The fit
  is done once, offline, by the code that already does it, so nothing is
  ported and nothing is typed twice.
- **`scripts/web-assets.ts`** takes those GLBs through `@gltf-transform`:
  dedup, weld, meshopt compression, textures resized to 2k and encoded as
  WebP, and writes `apps/web/public/models/<id>.glb` and
  `apps/web/public/models/manifest.json` (id, states, variant, evidence,
  attribution, bytes, sha256). Every file stays under 20 MB because
  Cloudflare Pages refuses files over 25 MiB; if the set outgrows the site,
  the models move to an R2 bucket and the manifest carries the base URL.
- **The viewer** loads the manifest and streams the models a state needs.

### 5.2 The viewer's scene

WebGL2, three 0.186, React Three Fiber 9, drei, and `postprocessing` through
`@react-three/postprocessing`. WebGPU is not taken now: the post-processing
stack and compressed-texture loaders are proven on WebGL2 and the look does
not need compute.

- `scene/Renderer.tsx`: AgX tone mapping, physically correct lights, shadow
  maps with three's cascaded shadow maps, the post chain (SMAA, N8AO ambient
  occlusion, a restrained bloom, vignette, the tone mapper).
- `scene/Sky.tsx`: a physical sky (Preetham to start, Hosek-Wilkie if it
  reads better) driven by a sun placed by `@seked/sky` for the chosen epoch,
  day of year and local time; the sun light and the environment map derive
  from it, so the lighting can never disagree with the astronomy. The
  existing star dome and a Milky Way background come up as the sun sets.
- `scene/Atmosphere.ts`: aerial perspective and height fog as a shader chunk
  injected into every material, tinted by the sun; a low dust or mist layer
  over water and sand at dawn.
- `scene/materials/`: triplanar stone with colour, normal and roughness maps
  (the web textures gain normal and roughness at 2k), pristine casing with a
  clearcoat and course joints from the database's course heights, granite,
  basalt, sand with ripples, water with planar reflection and refraction.
- `scene/Structures/`: the procedural plateau per state, from the builders in
  `@seked/geometry`; instanced where it repeats.
- `scene/Standins.tsx`: the manifest's GLBs by state and variant, with a
  hover label carrying the manifest's attribution and evidence tier.
- `scene/Vegetation.tsx` and `scene/Water.tsx`.

Performance budget: 60 fps at 1440p on the RTX 5070 Ti; 30 fps at 1080p on an
integrated GPU with the post chain reduced. First load under 15 MB before
stand-ins, which stream.

### 5.3 The view state

`view.ts` gains `state`, a `moment` (day of year and local solar time, with
named presets for the moments the sky bake already carries), and `look`
(camera presets from the Blender views: dawn, panorama, harbour, akhet,
night). The `sky` layer becomes the star dome's visibility at night rather
than a day-night switch. All of it is in the URL.

### 5.4 The interface

A cinematic stage with an instrument drawer, replacing the paper sidebar.

- The scene is full-bleed. Over it, top-left, the wordmark and the caption
  line: state, epoch, moment, and the honesty word (survey, reconstruction,
  claim).
- Bottom: the timeline with its four stops, and beside it a sun dial for
  time of day and season.
- Right edge: a slim rail of icons opening drawers. Views (hero cameras),
  Layers, Claims (the existing list and detail), Section and measure, Sky
  (epoch, sidereal time, the named stars), Tour, About and provenance. All
  present functionality survives inside the drawers.
- In-scene labels on hover: name, evidence tier, source or stand-in note.
- Type: a serif display face for titles, a humanist sans for controls,
  tabular numerals for measurements. Dark glass panels over the scene, a warm
  sand accent, lapis for claims, the existing green and red for fits and
  misses. On narrow screens the rail becomes a bottom sheet.

## 6. The stages

Each stage ends deployed, with a snapshot row in `docs/progress/README.md`.
Stage 1 runs as four parallel tracks in worktrees, on a trunk commit that
puts the shared hooks in place first.

1. **Light, air, stone, and the shell.** The renderer, sky and sun from the
   sky package, atmosphere, post chain, shadows, PBR stone with normals,
   the hero camera presets; the interface shell with the drawers; the asset
   bake pipeline proven on today's Sphinx. The plateau still today-only,
   but it looks like the renders.
2. **States and the timeline.** The four states for every structure: the
   procedural builders (pyramidions, queens, mastabas, temples, walls,
   causeway, enclosure trench, sand levels), the Sphinx per state, the
   cross-fade, the caption line.
3. **The First Time.** Water, the Green Sahara, the polished casing's
   reflections, the electrum capstones and their night corona, the temple
   interiors, the statues (scans first, Meshy if needed), the basalt ways.
4. **Motion.** The tour rebuilt as camera paths through the eras with the
   sky rolling back, state transitions choreographed, and a way to record a
   film from the viewer.
5. **Claims in the new look**, then the LLM claims runner the plan always
   intended.

## 7. What does not change

CLAUDE.md's rules all hold: nothing typed twice, pyramids near survey,
stand-ins labelled with source and tier, claims as data, one frame, one
session at a time, named paths in commits. Licences are recorded and never
constrain a choice (Stewart, 2026-09-16). The generated Sphinxes stay
labelled as generated. The `claimed` tier is never promoted because a state
needs it: the ancient state is drawn as a claim, and says so.
