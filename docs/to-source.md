# To source

Things Stewart is finding for the project: references, drawings, scans, papers. Each says what it is for, where to
look and why it is not in hand yet. When one arrives, it is saved under `build/` (or `assets/` if it can be shared),
recorded where it is used, and moved to **Done** here with the date.

## Open

### Göbekli Tepe, Enclosure D: Pillars 20, 30 and 38 (added 23 October 2026)

- **For**: their relief height maps in `assets/gobekli-reliefs/` and carving them in the 9500 BCE ring
  (`render/gobekli_built.py`).
- **Need**: the excavators' line drawings, or straight-on photographs, of each carved face, labelled with the pillar
  number and the face (front, side, head). Known motifs, from the TEDI dictionary: Pillar 20's front, a snake moving
  towards an aurochs; Pillar 30, a snake and an H sign; Pillar 38, a bird, a bull's skull and a wild boar.
- **Where**: the DAI's blog, The Tepe Telegrams (https://www.dainst.blog/the-tepe-telegrams/): search "Pillar 20",
  "Pillar 30", "Pillar 38", "Enclosure D"; the snakes tag page (https://www.dainst.blog/the-tepe-telegrams/tag/snakes/)
  describes Pillar 20; post https://www.dainst.blog/the-tepe-telegrams/?p=2654. The definitive source is Dietrich and
  Schmidt, *Göbekli Tepe: The Imagery of the Pillars in the Monumental Buildings A–D, F and H* (Archaeologica
  Euphratica), which has drawings of every pillar.
- **Found, Pillar 20 (23 October 2026)**: the DAI's labelled photograph of its front, the aurochs and the snake
  (N. Becker, DAI; in "Why did it have to be snakes?", The Tepe Telegrams, 23 April 2016), read through the Wayback
  Machine and saved as `build/gobekli/references/dai-wayback/p20-front-becker-dai.jpg` (3060 by 4134). The relief is
  on the pillar's narrow front, between the wall's stretches. Still to make: its height map and its carving.
- **Why waiting** (Pillars 30 and 38): the DAI's website is down (23 October 2026); its archived pages load through the
  Wayback Machine (https://web.archive.org/web/2025/https://www.dainst.blog/the-tepe-telegrams/...), which is the next
  place to look. Two unnumbered candidates are in the Commons replica
  photographs (`build/gobekli/commons-d/`): a pillar with a large crane-like bird on its broad side, and one with a
  bundle of snakes under a U-shaped sign on its front.

### Göbekli Tepe, Pillar 31's neck and Pillar 43's narrow sides (added 23 October 2026)

- **For**: completing those pillars' carving.
- **Need**: a straight-on photograph or drawing of Pillar 31's front at the top of the shaft (the bull's skull on
  its neck), and of Pillar 43's two narrow sides (its relief wraps onto them).
- **Where**: the same DAI sources; for Pillar 43, Andrew Collins's page (https://www.andrewcollins.com/page/news/P43.htm).

### Göbekli Tepe, the DAI's 3D scan of Pillar 18 (noted 21 October 2026)

- **For**: carving Pillar 18 from the scan instead of a redrawing.
- **Need**: the scan (Hochschule Karlsruhe for the DAI); only renders of it are published.
- **Where**: a request to the DAI (Göbekli Tepe Research Project). Stewart's to send.

### Hawara: the Labyrinth plan's origin (added 23 October 2026)

- **For**: crediting the reconstruction the Labyrinth model follows (`render/giza/labyrinth.py`).
- **Need**: the original of the plan on the Mataha report's cover (Hawara 2008, version VII 08.2010): a square
  enclosure with a Greek-key corridor all round, a gate on each side, a north-south avenue and six colonnaded courts
  either side of it, each with a dark chapel at its outer end. Who drew it, in which book, which plate.
- **Ruled out (23 October 2026)**: Kircher's Labyrinth plate in *Turris Babel* (1679, p. 78; the one Wikipedia
  dates 1670). It is a different design: twelve nome panels round a central maze, with a frieze of figures
  (`build/hawara/reference/kircher/commons-labyrinth-960.jpg`, from Wikimedia Commons). The Mataha substack
  credits the cover to Louis De Cordier and names no source.
- **Where next**: Luigi Canina's *L'architettura antica* (Egyptian volume, 1830s-40s) and other 19th-century
  reconstructions; the Pococke-derived Dutch plate of 1776 (plate XXIII) is a plan of the ruins, worth ruling out; or
  ask Louis De Cordier which source the cover used.

## Done

- **Which way Pillar 43's carved face faces** (23 October 2026): the DAI's post on Pillar 43, read through the
  Wayback Machine, puts the relief on the western broad side with its left end hidden by the perimeter wall: a radial
  pillar, face to the west. Applied in `render/gobekli_built.py`; see `docs/gobekli-reliefs.md`.
