/**
 * The glass tag beside the pointer, naming what it rests on.
 *
 * Three lines at most: the name in the display face, the evidence tier as a
 * small upper-case word coloured the way the caption colours its own honesty
 * word, and the first sentence of wherever the thing comes from. It never
 * takes a pointer event, so it cannot get between the reader and the scene it
 * is describing, and it flips to the other side of the pointer rather than
 * running off the edge of the window.
 *
 * `scene/Hover.tsx` decides what is under the pointer; this only draws it.
 */
import { firstSentence, useHover } from '../scene/Hover';

/**
 * How far from the pointer the tag sits, and how much room it needs before it
 * flips to the other side. Look choices, in CSS pixels.
 */
const OFFSET = { x: 16, y: 16, width: 300, height: 120 };

/**
 * The tiers, in the words the honesty rules use, mapped onto the classes the
 * caption already colours: the survey is the sand accent, a claim is the lapis
 * blue, and everything in between is quiet. A tier nobody has listed here is
 * shown as it is and drawn quietly, which is the safe way round.
 */
const TIER_KIND: Record<string, string> = {
  survey: 'survey',
  excavated: 'survey',
  instrumented: 'survey',
  reconstruction: 'reconstruction',
  'stand-in': 'reconstruction',
  claimed: 'claim',
  claim: 'claim',
  legendary: 'claim',
};

export function HoverTag(): React.JSX.Element | null {
  const hovered = useHover((s) => s.hovered);
  if (!hovered) return null;

  const flipX = hovered.x + OFFSET.width > window.innerWidth;
  const flipY = hovered.y + OFFSET.height > window.innerHeight;
  const kind = TIER_KIND[hovered.tier] ?? 'reconstruction';

  return (
    <div
      className="hover-tag"
      style={{
        left: hovered.x,
        top: hovered.y,
        transform: `translate(${flipX ? `calc(-100% - ${OFFSET.x}px)` : `${OFFSET.x}px`}, ${flipY ? `calc(-100% - ${OFFSET.y}px)` : `${OFFSET.y}px`})`,
      }}
    >
      <p className="hover-name">{hovered.name}</p>
      <p className={`hover-tier is-${kind}`}>{hovered.tier}</p>
      {hovered.note ? <p className="hover-note">{firstSentence(hovered.note)}</p> : null}
    </div>
  );
}
