# Göbekli Tepe relief height maps

Height maps of the carved reliefs on the pillars of Enclosure D at Göbekli Tepe, made for 3D modelling: put one on a
pillar's face as a displacement map and the carving stands out. We made them for [Seked](../../README.md) and share
them here so the next person modelling Göbekli Tepe does not have to start from nothing. They are a modelling aid,
not survey data: each one is redrawn from the excavators' drawings and from photographs, by an image model and then
by hand, as described below.

| Face | Source map | Cleaned map | What is on it |
|---|---|---|---|
| Pillar 43, the "Vulture Stone", carved broad face | `source/p43-front.png` | `cleaned/p43-front.png` | three bag-like objects across the top, the zigzag bands, the vulture with its disc, the birds, the scorpion, the lower bird; the stone's outline as the excavators drew it |
| Pillar 18 (central pair, east), a broad side of the shaft | `source/p18-side.png` | `cleaned/p18-side.png` | the arm bent at the elbow running down to the hand at the front edge, the fox inside the arm, the belt of H and crescent signs, the start of the fox-pelt loincloth |
| Pillar 18, the narrow front of the shaft | `source/p18-front.png` | `cleaned/p18-front.png` | the two signs at the top (an H and a ring), the two bands of the "stola", the hands meeting, the belt with its U-shaped buckle, the hanging pelt |
| Pillar 31 (central pair, west), a broad side of the shaft | `source/p18-side.png`, fox erased | `cleaned/p31-side.png` | the same arm and belt as Pillar 18's, and no fox, as photographs of its replica show; made from Pillar 18's map with the fox taken out |
| Pillar 31, the narrow front of the shaft | `source/p31-front.png` | `cleaned/p31-front.png` | the stola's two bands, the hands meeting, the belt's U buckle, the hanging pelt (the bull's skull on its neck is above the photograph's frame and is not in the map) |
| Pillar 33, carved broad face | `source/p33-broad.png` | `cleaned/p33-broad.png` | the excavators' numbered drawing: cranes, snakes, a fox and other animals packed over the head and shaft; the T outline as drawn |
| Pillar 27 (Enclosure C, not D), broad face | `source/p27-broad-depth.png` | `cleaned/p27-broad.png` | the predator carved almost in the round, head down, and the wild boar in low relief below it; a depth map of a photograph, not a redrawing (see below) |

## How to read them

- **Source maps**: white is the raised carving, mid grey the stone's original surface, and the line drawing's own
  strokes are still in them (dark lines round and inside the motifs).
- **Cleaned maps** (16-bit greyscale PNG): black is the stone's surface, white the full height of the carving. The
  drawing's strokes are gone (an outline becomes the motif's edge, a stroke inside a motif becomes a shallow incised
  line), the edges have a short bevel, and each map is cropped to the stone. `reliefs.json` records the crop and,
  for Pillar 43, the stone's outline as drawn: its broad top runs down 61 per cent of the height before the step to
  the shaft, and the shaft spans the left 77 per cent of the width.
- **Orientation**: each map is the face seen straight on. On the Pillar 18 side, the front of the pillar (the end
  with the hands and the belt's buckle) is on the right; use it mirrored for the other broad side. On Pillar 43, the
  right is the end towards the enclosure's middle, where the T's head overhangs.
- **Depth**: the reliefs at Göbekli Tepe are mostly low, a few centimetres. Seked uses 4 cm for white, and 25 cm for
  Pillar 27, whose predator stands far out from the face (`raise_m` in `reliefs.json`).

In Blender: a plane subdivided to about 1 cm, the cleaned map on a Displace modifier (texture coordinates UV, colour
space Non-Color, strength 0.04 m, midlevel 0). Or sample the PNG yourself, as `render/gobekli_built.py` does.

## How they were made

1. **References**, per face: the excavators' line drawing where one is published (it fixes the motifs and their
   places) and the straightest photographs (they give the depth and the character of the cutting). See
   [docs/gobekli-reliefs.md](../../docs/gobekli-reliefs.md) for the list.
2. **A height map from an image model** (Google's Gemini image model, `scripts/sphinx_lab/banana.py`), given the
   drawing and a photograph, with a prompt asking for a straight-on, orthographic, evenly lit depth image: white
   raised, mid grey the original surface, nothing invented where the drawing shows nothing. The prompt for Pillar 43,
   in full:

   > The first image is the excavators' line drawing of the front (south-east) face of Pillar 43, the "Vulture
   > Stone", at Göbekli Tepe. The second image is a photograph of the same face. Make a height map of the carved
   > relief for a 3D artist: a straight-on, orthographic, evenly lit greyscale depth image of the whole face as the
   > drawing shows it, the outline of the stone exactly as in the drawing. Rules: white is the raised surface of the
   > carved motifs, black is the cut-back background; the original stone surface outside the carved panels is mid
   > grey. Edges of each motif fall off over a short bevel, as low relief carved in limestone does, and the inner
   > details (feathers, the zigzag band, the scorpion's legs, the vulture's head and wing, the three bag-like objects
   > across the top, the disc) are shallow grooves cut into the raised motif, slightly darker. Follow the drawing's
   > outlines exactly: same motifs, same positions, same proportions, nothing added, nothing invented where the
   > drawing shows nothing. Where the stone is broken (dashed lines at the bottom), leave the surface plain mid
   > grey. No shading, no lighting, no texture, no text, no border: only depth.

3. **Checked by eye** side by side against the drawing, motif by motif. Not every attempt passes: for Pillar 27 the
   model twice "tidied" the stylised predator into a naturalistic lion and invented a realistic boar, so that face
   was made differently, by asking the model for a pixel-aligned depth map of the photograph itself (which keeps the
   carving's own shapes); the cleaning script then fits the stone's tilted face as a plane and takes it off. For
   Pillar 31's side the model drew the arm on the wrong path, so its map is Pillar 18's with the fox erased, which
   is what the photographs of Pillar 31 show.
4. **Cleaned in code**: `python scripts/gobekli_reliefs.py` reads `source/` and writes `cleaned/` and `reliefs.json`
   (Python with numpy, Pillow and SciPy). The crops are read off the sources by hand and live in the script.

## Sources and credit

The carvings are about 11,500 years old. The maps are our own redrawing, but they follow other people's work
closely, and those people are owed the credit:

- **Pillar 43**: the excavators' line drawing (Deutsches Archäologisches Institut, Göbekli Tepe project), as
  reproduced by Andrew Collins (https://www.andrewcollins.com/page/news/P43.htm), with his photographs of the face;
  the DAI's account, "Of animals and a headless man"
  (https://www.dainst.blog/the-tepe-telegrams/2016/10/14/of-animals-and-a-headless-man-gobekli-tepe-pillar-43/).
- **Pillar 18**: the DAI's 3D-scan renders (Hochschule Karlsruhe, © DAI, on the Tepe Telegrams blog) and
  photographs of the pillar at night.
- **Pillar 31**: photographs of the full-size replica of Enclosure D in the Şanlıurfa Archaeology Museum by
  Dosseman on Wikimedia Commons (CC BY-SA 4.0), "Urfa museum Gobeklitepe Temple D replica sept 2019 4824" and
  "Urfa museum Gobeklitepe Temple D replica 4831".
- **Pillar 33**: the excavators' numbered line drawing and a photograph of the face (DAI), as reproduced in the
  reference set gathered for Seked.
- **Pillar 27**: photograph "Göbeklitepe Building C sept 2019 5373crop" by Dosseman on Wikimedia Commons
  (CC BY-SA 4.0).

The drawings, scans and photographs themselves are not in this folder and are not ours to share. If you hold rights
in one of them and want a map taken down or credited differently, open an issue.

## Still to make

- **Pillars 20, 30 and 38** in Enclosure D. The motifs are known in outline (Pillar 20's front: a snake moving
  towards an aurochs; Pillar 30: a snake and an H sign; Pillar 38: a bird, a bull's skull and a wild boar, by the
  TEDI dictionary of Göbekli Tepe), but no photograph we could reach was labelled with the pillar's number, and a map
  is not made from a description alone. The replica photographs on Commons include a pillar with a large crane-like
  bird on its broad side and chevron and "ladder" bands on its front, and a pillar whose front carries a bundle of
  snakes under a U-shaped sign; once each is matched to its number (the DAI's Tepe Telegrams blog has every
  Enclosure D pillar), they can be made the same way.
- Pillar 31's neck, with its bull's skull, and the narrow sides of Pillar 43 (its relief wraps onto them).

Contributions welcome, made the same way.
