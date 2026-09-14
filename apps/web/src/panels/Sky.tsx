import { formatEpoch, type Claim } from '@seked/claims/browser';
import { calendarDate, calendarYearOfEpoch, datedSunEnvironment, deltaT } from '@seked/sky/browser';
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Decimal hours as a clock reading; the word "never" where the sun never crossed the horizon that day. */
function meanTimeClock(hours: number): string {
  if (!Number.isFinite(hours)) return 'never';
  const minutes = Math.round(((hours % 24) + 24) % 24 * 60) % 1440;
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

/** ΔT in whichever unit reads: hours once it has reached one, minutes while it is small. */
function formatDeltaT(seconds: number): string {
  const size = Math.abs(seconds);
  return `${seconds < 0 ? '−' : ''}${size < 3600 ? `${Math.round(size / 60)} min` : `${(size / 3600).toFixed(1)} h`}`;
}

/**
 * The June solstice of the epoch as it happened on the ground: the date it
 * fell on in the observer's own calendar, and the local mean times of that
 * morning's sunrise and that evening's sunset.
 *
 * The instant the environment carries is in TT. Taking ΔT off it and adding
 * the longitude is what turns it into a reading on a local clock, and at these
 * epochs ΔT alone is sixteen hours, so the day it fell on where the observer
 * stood is often not the day it falls on in TT.
 */
function juneSolstice(epoch: number, latitudeDeg: number, longitudeDeg: number): { date: string; rise: string; set: string; deltaT: string } {
  const env = datedSunEnvironment({ epoch, latitudeDeg, longitudeDeg });
  const seconds = deltaT(calendarYearOfEpoch(epoch));
  const local = calendarDate((env['sun.june_solstice.jd'] as number) - seconds / 86400 + longitudeDeg / 360);
  return {
    date: `${Math.floor(local.day)} ${MONTHS[local.month - 1] as string}`,
    rise: meanTimeClock(env['sun.june_solstice.rise.local_mean_time'] as number),
    set: meanTimeClock(env['sun.june_solstice.set.local_mean_time'] as number),
    deltaT: formatDeltaT(seconds),
  };
}

/**
 * The two controls the sky needs and one thing to say about each. The epoch
 * is the interesting one: it draws the stars of that year and, at the same
 * time, evaluates every dated claim at it instead of at the epoch its author
 * chose, so the residuals in the claims panel move while the dome turns. That
 * is the whole of the plan's "drag the sky back to 10,500 BCE and watch each
 * claim's residual move".
 *
 * Under it is the one dated fact in the viewer: where that epoch's June
 * solstice fell on a calendar and on a clock. Everything else on this panel is
 * sidereal and needs no date at all, which is why this line is the first thing
 * here to depend on ΔT.
 */
export function SkyControls({
  epoch,
  named,
  claim,
  latitudeDeg,
  longitudeDeg,
}: {
  /** The epoch actually drawn, override or not. */
  epoch: number;
  named: NamedDomeStar[];
  /** The open claim, whose own epoch the override is measured against. */
  claim: Claim | undefined;
  /** The observer, from the site's origin in the database rather than from a constant here. */
  latitudeDeg: number;
  longitudeDeg: number;
}): React.JSX.Element {
  const override = useView((s) => s.epoch);
  const setEpoch = useView((s) => s.setEpoch);
  const lst = useView((s) => s.lst);
  const setLst = useView((s) => s.setLst);
  const layers = useView((s) => s.layers);
  const toggleLayer = useView((s) => s.toggleLayer);

  const claimEpoch = claim?.epoch;
  const following = claimEpoch !== undefined ? `${claim?.id}, at ${formatEpoch(claimEpoch)}` : `the default, ${formatEpoch(DEFAULT_EPOCH)}`;
  const solstice = juneSolstice(epoch, latitudeDeg, longitudeDeg);

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

      <p className="note">
        June solstice of {formatEpoch(epoch)}: <strong>{solstice.date}</strong>, sunrise <strong>{solstice.rise}</strong>, sunset{' '}
        <strong>{solstice.set}</strong> local mean time (ΔT {solstice.deltaT}).
      </p>
      <p className="note">
        The calendar is the proleptic Julian one, and the times are mean solar time on the meridian of the Great Pyramid rather than any
        civil clock: no time zone, no summer time, and a flat sea-level horizon in place of the plateau's own skyline. Meeus's polynomial
        for the instant is fitted between 1000 BCE and 3000 CE, so everything earlier is an extrapolation: out by hours at 2450 BCE and by
        days at 10,500 BCE, where the date is worth reading as a season and nothing finer.
      </p>

      <label className="field">
        <span className="field-label">
          Sidereal time <output>{lst.toFixed(1)}° · {siderealClock(lst)}</output>
        </span>
        <input type="range" min={LST_MIN} max={LST_MAX} step={LST_STEP} value={lst} onChange={(e) => setLst(Number(e.target.value))} />
      </label>
      <p className="note">
        The hour angle of the equinox of date at this meridian, which is what turns the dome. Turning a calendar date into it needs UT1 and
        ΔT, which the sky package's calendar now carries; a transit claim is a statement about sidereal time alone, so none of them waits
        for a clock.
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
