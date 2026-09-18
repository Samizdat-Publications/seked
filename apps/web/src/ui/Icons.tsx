/**
 * The rail's glyphs. Drawn rather than lettered, one per drawer, all on the
 * same 24 unit grid with the same stroke, so the rail reads as one instrument
 * and not as a row of borrowed pictograms. They carry no meaning the label
 * beside them does not, and every button that uses one is labelled.
 */
import type { DrawerId } from './ui';

const box = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** A viewfinder: four corners and the point they are put on. */
const Views = (): React.JSX.Element => (
  <svg {...box}>
    <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

/** Three plates of the plateau, stacked. */
const Layers = (): React.JSX.Element => (
  <svg {...box}>
    <path d="M12 3.5 21 8l-9 4.5L3 8z" />
    <path d="m4.6 12 7.4 3.7 7.4-3.7" />
    <path d="m4.6 16 7.4 3.7 7.4-3.7" />
  </svg>
);

/** A balance: a claim is a thing weighed against a measurement. */
const Claims = (): React.JSX.Element => (
  <svg {...box}>
    <path d="M12 4v16M7 20h10" />
    <path d="M4 8h16" />
    <path d="M2.5 13a3 3 0 0 0 5 0L5 8zM16.5 13a3 3 0 0 0 5 0L19 8z" />
  </svg>
);

/** A block with the near half cut away, which is what the section plane does. */
const Section = (): React.JSX.Element => (
  <svg {...box}>
    <path d="M4 20V9l8-5 8 5v11z" />
    <path d="M12 4v16" />
    <path d="M12 20 4 15.5V9l8 5z" fill="currentColor" fillOpacity="0.32" stroke="none" />
  </svg>
);

/** A star of the epoch, with two lesser ones for the catalogue behind it. */
const Sky = (): React.JSX.Element => (
  <svg {...box}>
    <path d="m13.5 4 1.9 4.4 4.6.5-3.4 3.2 1 4.6-4.1-2.4-4.1 2.4 1-4.6L7 8.9l4.6-.5z" />
    <path d="M4.5 16.5v2.2M3.4 17.6h2.2M18.5 18v1.8M17.6 18.9h1.8" />
  </svg>
);

/** A route across the plateau, stopping at three views. */
const Tour = (): React.JSX.Element => (
  <svg {...box}>
    <path d="M5 19c4.5 0 3-6 7.5-6S20 9 20 5" />
    <circle cx="5" cy="19" r="1.8" />
    <circle cx="12.5" cy="13" r="1.5" />
    <circle cx="20" cy="5" r="1.8" />
  </svg>
);

/** The mark every honest page carries. */
const About = (): React.JSX.Element => (
  <svg {...box}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.9" />
  </svg>
);

/** A frame of film: the gate and its two sprocket holes a side. */
const Film = (): React.JSX.Element => (
  <svg {...box}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M7 5v14M17 5v14" />
    <path d="M3.5 9h3.5M3.5 15h3.5M17 9h3.5M17 15h3.5" />
  </svg>
);

export const ICONS: Record<DrawerId, () => React.JSX.Element> = {
  views: Views,
  layers: Layers,
  claims: Claims,
  section: Section,
  sky: Sky,
  tour: Tour,
  film: Film,
  about: About,
};

/** The one glyph the rail does not own: shutting the drawer it opened. */
export const CloseIcon = (): React.JSX.Element => (
  <svg {...box} width="18" height="18">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
