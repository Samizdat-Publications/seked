import { formatEpoch, type Claim } from '@seked/claims/browser';
import { formatDms } from '@seked/units';
import type { NamedDomeStar } from '../sky';
import { useView } from '../store';
import { DEFAULT_EPOCH, EPOCH_MAX, EPOCH_MIN, EPOCH_STEP, LST_MAX, LST_MIN, LST_STEP } from '../view';

/** Sidereal time as hours and minutes, which is how a star atlas states it. */
function siderealClock(deg: number): string {
  const hours = (deg / 15 + 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/**
 * The two controls the sky needs and one thing to say about each. The epoch
 * is the interesting one: it draws the stars of that year and, at the same
 * time, evaluates every dated claim at it instead of at the epoch its author
 * chose, so the residuals in the claims panel move while the dome turns. That
 * is the whole of the plan's "drag the sky back to 10,500 BCE and watch each
 * claim's residual move".
 */
export function SkyControls({
  epoch,
  named,
  claim,
}: {
  /** The epoch actually drawn, override or not. */
  epoch: number;
  named: NamedDomeStar[];
  /** The open claim, whose own epoch the override is measured against. */
  claim: Claim | undefined;
}): React.JSX.Element {
  const override = useView((s) => s.epoch);
  const setEpoch = useView((s) => s.setEpoch);
  const lst = useView((s) => s.lst);
  const setLst = useView((s) => s.setLst);
  const layers = useView((s) => s.layers);
  const toggleLayer = useView((s) => s.toggleLayer);

  const claimEpoch = claim?.epoch;
  const following = claimEpoch !== undefined ? `${claim?.id}, at ${formatEpoch(claimEpoch)}` : `the default, ${formatEpoch(DEFAULT_EPOCH)}`;

  return (
    <section className="block">
      <h2>Sky</h2>

      <ul className="toggles">
        <li>
          <label>
            <input type="checkbox" checked={layers.sky} onChange={() => toggleLayer('sky')} />
            Star dome, and the scene by night
          </label>
        </li>
      </ul>

      <label className="field">
        <span className="field-label">
          Epoch <output>{formatEpoch(epoch)}</output>
        </span>
        <input
          type="range"
          min={EPOCH_MIN}
          max={EPOCH_MAX}
          step={EPOCH_STEP}
          value={epoch}
          onChange={(e) => setEpoch(Number(e.target.value))}
        />
      </label>
      <p className="note">
        {override === null ? (
          <>Following {following}. Every dated claim keeps its own epoch.</>
        ) : (
          <>
            Every dated claim is evaluated here instead of at its own epoch.{' '}
            <button type="button" className="link" onClick={() => setEpoch(null)}>
              {claimEpoch === undefined ? 'stop overriding the epoch' : `back to ${claim?.id}'s own ${formatEpoch(claimEpoch)}`}
            </button>
          </>
        )}
      </p>

      <label className="field">
        <span className="field-label">
          Sidereal time <output>{lst.toFixed(1)}° · {siderealClock(lst)}</output>
        </span>
        <input type="range" min={LST_MIN} max={LST_MAX} step={LST_STEP} value={lst} onChange={(e) => setLst(Number(e.target.value))} />
      </label>
      <p className="note">
        The hour angle of the equinox of date at this meridian, which is what turns the dome. Turning a calendar date into it needs UT1 and
        ΔT, which arrive with the Sun; a transit claim is a statement about sidereal time alone, so none of them waits for a clock.
      </p>

      <h3 className="subhead">Put a star on the meridian</h3>
      <ul className="transits">
        {named.map((star) => (
          <li key={star.id}>
            <button type="button" className="transit" onClick={() => setLst(star.raDeg)} title={`right ascension ${formatDms(star.raDeg)} at this epoch`}>
              {star.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="note">
        A star is on the meridian at upper culmination when the sidereal time equals its right ascension, which precession moves: these
        buttons read the right ascension of the epoch above, not of J2000.
      </p>
    </section>
  );
}
