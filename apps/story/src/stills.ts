/**
 * The stage's stills, until the sequences exist (docs/plan.html, phase 2):
 * committed renders, each shown from the beat whose words it illustrates
 * until the next one. Only renders that agree with the rethink are used: the
 * master Sphinx and its eras, the First Time without pyramids, the Blender
 * scenes and the alignments' frames. The viewer's screenshots carry its
 * interface and the September stand-ins are superseded, so neither is here.
 *
 * `src` is a path under the site's root (`progress/` is docs/progress,
 * `alignments/` is apps/alignments), which the page reaches as `../src`
 * beside it on the site and the dev server serves the same way.
 */

export type Tag = 'claim state' | 'stand-in' | 'reconstruction' | 'look choices';

export interface Still {
  chapter: number;
  /** A beat's anchor, word for word: the still shows from these words on. */
  anchor: string;
  src: string;
  alt: string;
  tags: Tag[];
  /** Diagrams and annotated frames are shown whole on a dark ground; scenes fill the stage. */
  whole?: true;
}

const SPHINX_TODAY = 'progress/0040-sphinx-today.png';
const LION_FIRST_TIME = 'progress/0035-master-lion-first-time.png';
const LION_RAINS = 'progress/0035-master-lion-long-rains.png';

export const STILLS: Still[] = [
  { chapter: 0, anchor: 'This is Giza at dawn', src: 'progress/0018-blender-dawn-materials-air.png',
    alt: 'The pyramids as they stand, at the equinox dawn', tags: [] },
  { chapter: 0, anchor: 'Behind it stand the pyramids of Khufu and Khafre.', src: SPHINX_TODAY,
    alt: 'The Sphinx today, from above its enclosure, the pyramids behind', tags: ['stand-in'] },
  { chapter: 0, anchor: 'go back to about 10,500 BCE', src: LION_FIRST_TIME,
    alt: 'The lion in the First Time, c. 10,500 BCE, the plateau green and no pyramids', tags: ['claim state', 'stand-in'] },

  { chapter: 1, anchor: 'The Sphinx was not built.', src: SPHINX_TODAY,
    alt: 'The Sphinx in its ditch today', tags: ['stand-in'] },
  { chapter: 1, anchor: 'so the front was cut long before the back', src: LION_RAINS,
    alt: 'The lion in the long rains, c. 7000 BCE', tags: ['claim state', 'stand-in'] },
  { chapter: 1, anchor: 'about 10,000 BCE', src: LION_FIRST_TIME,
    alt: 'The lion freshly cut, c. 10,500 BCE', tags: ['claim state', 'stand-in'] },

  { chapter: 2, anchor: 'Look at the head.', src: 'progress/0035-master-lion-as-built.png',
    alt: 'The Sphinx as built, c. 2500 BCE, Khafre’s pyramid behind', tags: ['stand-in'] },
  { chapter: 2, anchor: 'The figure was a lion first.', src: LION_FIRST_TIME,
    alt: 'The lion head of the First Time', tags: ['claim state', 'stand-in'] },
  { chapter: 2, anchor: 'Here the king’s head sits inside the lion’s', src: 'progress/0036-ghost-lion-round-the-king.png',
    alt: 'The weathered lion’s head ghosted round the king’s', tags: ['claim state', 'stand-in'] },
  { chapter: 2, anchor: 'At the spring equinox the sun rises close to due east in every age', src: 'alignments/img/c5-taurus-dawn-2500.jpg',
    alt: 'The equinox dawn of 2500 BCE from behind the Sphinx: the sun rises in Taurus', tags: [], whole: true },
  { chapter: 2, anchor: 'rose in the east just before the equinox sun', src: 'alignments/img/c5-leo-dawn-10500.jpg',
    alt: 'The equinox dawn of 10,500 BCE from behind the lion: Leo along the horizon', tags: ['claim state'], whole: true },

  { chapter: 3, anchor: 'At the Sphinx’s paws stand two temples.', src: 'progress/0025-blender-harbour-as-built.png',
    alt: 'The two temples at the Sphinx’s paws as built, from the air north-east', tags: ['reconstruction'] },

  { chapter: 4, anchor: 'Egypt did not think it began with its first king.', src: LION_FIRST_TIME,
    alt: 'The First Time: the lion, the green plateau, no pyramids', tags: ['claim state', 'stand-in'] },
  { chapter: 4, anchor: 'Hancock and Bauval look for one in the sky.', src: 'progress/0020-blender-night-milky-way.png',
    alt: 'The night of 2449 BCE over the pyramids, with the Milky Way', tags: [] },

  { chapter: 5, anchor: 'laid out like the three stars of Orion’s belt', src: 'alignments/img/c4-orion-plan.jpg',
    alt: 'The three pyramids from above with Orion’s belt fitted over them', tags: [], whole: true },
  { chapter: 5, anchor: 'Drag the sky back.', src: 'alignments/img/c4-orion-night.jpg',
    alt: 'The night of 10,450 BCE looking south: Orion over the three pyramids', tags: ['claim state'], whole: true },
  { chapter: 5, anchor: 'Inside the Great Pyramid', src: 'alignments/img/c2-shafts-2450.jpg',
    alt: 'The Great Pyramid’s shafts carried out as rays into the sky of 2450 BCE', tags: [], whole: true },
  { chapter: 5, anchor: 'the stone holds two dates', src: 'alignments/img/c2-shafts-10450.jpg',
    alt: 'The same shafts under the sky of 10,450 BCE', tags: ['claim state'], whole: true },

  { chapter: 6, anchor: 'Measure the Great Pyramid.', src: 'progress/0026-blender-dawn-as-built.png',
    alt: 'The Great Pyramid as built, its casing restored', tags: ['reconstruction'] },
  { chapter: 6, anchor: 'Draw a line from the apex down the middle of one face.', src: 'progress/0011-blender-section-drawing.png',
    alt: 'The Great Pyramid in section from the east, from Petrie’s survey', tags: [], whole: true },

  { chapter: 7, anchor: 'a plan laid out at Giza in the eleventh millennium BCE', src: LION_FIRST_TIME,
    alt: 'Giza’s First Time: the green Sahara, the lion, no pyramids', tags: ['claim state', 'stand-in'] },

  { chapter: 8, anchor: 'Everything so far stands on the surface.', src: 'progress/0037-underneath-khafre-cutaway.png',
    alt: 'Khafre’s pyramid and the plateau cut away, the claimed wells and chambers below', tags: ['look choices'], whole: true },
  { chapter: 8, anchor: 'three metres under its base', src: 'progress/0037-underneath-khafre-base.png',
    alt: 'The base of Khafre’s pyramid in section: the excavated rooms and the claimed Zeds', tags: ['look choices'], whole: true },
  { chapter: 8, anchor: 'larger than the Great Pyramid’s base', src: 'progress/0038-labyrinth-at-giza.png',
    alt: 'The Labyrinth’s bed and Amenemhat III’s pyramid, at Hawara 80 km south, laid on Giza for scale', tags: [], whole: true },
  { chapter: 8, anchor: 'walls eight to twelve metres down', src: 'progress/0039-hawara-section.png',
    alt: 'The ground under the Labyrinth by tier, depths drawn four times their true size', tags: [], whole: true },

  { chapter: 9, anchor: 'Much of this case can be tested.', src: SPHINX_TODAY,
    alt: 'The Sphinx in its ditch today', tags: ['stand-in'] },
  { chapter: 9, anchor: 'Underneath', src: 'progress/0037-underneath-khafre-reply.png',
    alt: 'The claim against radar’s reach and the water table', tags: ['look choices'], whole: true },
  { chapter: 9, anchor: 'An answer looks like this', src: 'progress/0013-blender-big-void.png',
    alt: 'The Big Void over the Grand Gallery, drawn as its two hypotheses', tags: [], whole: true },
  { chapter: 9, anchor: 'Until it is, that is where to look.', src: SPHINX_TODAY,
    alt: 'The Sphinx today', tags: ['stand-in'] },
];

/** Curly and straight apostrophes compare alike, as the script mixes them; both are one character. */
const fold = (s: string) => s.replace(/[’‘]/g, "'");

const OPEN = '\u0001';
const CLOSE = '\u0002';

/**
 * Put a marker before each anchor's first appearance in a paragraph, to be turned into a scroll
 * marker after the Markdown is rendered (`markers`). The markers are control characters, which the
 * Markdown leaves alone. Returns the paragraph and the indices of the anchors it held.
 */
export function markAnchors(paragraph: string, anchors: string[]): { text: string; found: number[] } {
  const hits: { at: number; i: number }[] = [];
  const folded = fold(paragraph);
  anchors.forEach((a, i) => {
    const at = folded.indexOf(fold(a));
    if (at >= 0) hits.push({ at, i });
  });
  let text = paragraph;
  for (const h of [...hits].sort((x, y) => y.at - x.at)) text = text.slice(0, h.at) + OPEN + h.i + CLOSE + text.slice(h.at);
  return { text, found: hits.map((h) => h.i) };
}

/** Turn `markAnchors`' markers into empty spans the page watches as it scrolls. */
export const markers = (html: string, attr: (i: number) => string) =>
  html.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'), (_, i: string) => `<span class="beat" ${attr(Number(i))}></span>`);
