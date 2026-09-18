/**
 * How far each of a claim's comparisons falls from its target, drawn.
 *
 * The table below this says the same numbers, and says them more precisely.
 * What a table cannot do is show at a glance that three shafts sit inside the
 * allowance and the fourth does not, which is the whole verdict on a claim
 * like C2 and is the thing a reader came for.
 *
 * The form is a diverging bar against a shaded band, because the data is a
 * signed distance from a target with a threshold on it: the band is the
 * tolerance the claim allowed itself, the bar is where it actually landed,
 * and a bar that reaches past the band is a miss. That reading is positional
 * and survives any colour vision, which matters here: the project's `--fits`
 * green and `--misses` terracotta are only 6.2 apart in OKLab for a
 * deuteranope, inside the band where colour may not be the only encoding. So
 * colour merely agrees with the band, the hatch and the words beside it.
 *
 * It is HTML and not SVG. A comparison's label is a sentence and the drawer
 * is narrow, and letting CSS truncate one line is worth more than whatever
 * SVG would have given.
 *
 * A residual can be twenty times the allowance (C5's Regulus is eleven per
 * cent against half a per cent), and a scale that fitted it would squeeze the
 * band to a hairline, so the track is clamped and anything past it keeps a
 * mark at the edge. The figure printed is always the real one.
 */
import { formatResidual, type ComparisonResult } from '@seked/claims/browser';

/** How much of the track's half-width the allowance takes, so the band is always a readable stripe. */
const BAND_SHARE = 0.3;

/** What a comparison is judged by: its absolute allowance where it has one, else its percentage. */
function scaleOf(c: ComparisonResult): { value: number; allowed: number } {
  // A target of zero has no percentage, so those comparisons declare an
  // absolute tolerance and are judged in their own unit instead.
  if (c.toleranceAbs !== undefined) return { value: c.absolute, allowed: c.toleranceAbs };
  return { value: c.residualPct, allowed: c.tolerancePct };
}

export function Residuals({
  comparisons,
  worstIndex,
}: {
  comparisons: ComparisonResult[];
  worstIndex: number;
}): React.JSX.Element | null {
  if (comparisons.length === 0) return null;

  return (
    <figure className="residuals">
      <figcaption>
        Each bar is how far the comparison landed from its target. The shaded stripe is the tolerance the claim allowed itself, so
        a bar that stays inside it holds and a bar that runs past it does not.
      </figcaption>
      {comparisons.map((c, i) => {
        const { value, allowed } = scaleOf(c);
        // Every row is on its own scale: one comparison may be in degrees and
        // the next a ratio, and what is compared across rows is how far out of
        // its own allowance each one is, never how many units.
        const domain = allowed / BAND_SHARE;
        const frac = Math.max(-1, Math.min(1, value / domain));
        const beyond = Math.abs(value) > domain;
        const half = Math.abs(frac) * 50;
        return (
          <div className="residual-row" key={c.label} title={`${c.label}: ${formatResidual(c)}`}>
            <p className="residual-head">
              <span className="residual-label">{c.label}</span>
              {/* Outside the label, which truncates: a badge inside it would be the first thing clipped. */}
              {i === worstIndex && comparisons.length > 1 && <span className="residual-worst">worst</span>}
              <span className="residual-figure num">{formatResidual(c)}</span>
            </p>
            <div className="residual-track">
              <span className="residual-band" style={{ left: `${50 - BAND_SHARE * 50}%`, width: `${BAND_SHARE * 100}%` }} />
              <span className="residual-zero" />
              <span
                className={`residual-bar ${c.within ? 'is-within' : 'is-outside'}`}
                style={value >= 0 ? { left: '50%', width: `${half}%` } : { right: '50%', width: `${half}%` }}
              />
              {beyond && <span className={`residual-over ${value > 0 ? 'is-right' : 'is-left'}`} aria-hidden="true" />}
            </div>
          </div>
        );
      })}
    </figure>
  );
}
