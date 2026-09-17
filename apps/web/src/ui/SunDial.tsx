/**
 * The sun dial: a half circle of the whole day, midnight at the left end,
 * noon at the top, midnight again at the right, with the sun riding it at the
 * hour the scene is drawn for. Dragging the sun along the arc sets the hour.
 *
 * It says nothing about where the sun really stood. The arc is the clock and
 * not the ecliptic: the sun's true altitude for a day, an hour and an epoch is
 * the sky package's to compute, and putting a second answer to that question
 * in a widget is exactly the sort of thing this project does not do. What the
 * dial owns is the reading, which is why the hour is printed beside it.
 *
 * The date sits under a popover with the four named moments and a day slider,
 * because a reader wants the hour to hand and the season only now and then.
 */
import { useEffect, useRef, useState } from 'react';
import { useView } from '../store';
import { DAY_MAX, DAY_MIN, HOUR_MAX, HOUR_MIN, MOMENTS } from '../view';
import { clock, dateWords } from './moment';

/** The dial's own drawing, in its viewBox: centre, radius, and the box. */
const DIAL = { cx: 100, cy: 100, r: 82, width: 200, height: 116 } as const;

/** Where on the arc an hour falls, in the viewBox's coordinates. */
function onArc(hour: number): { x: number; y: number } {
  const theta = (Math.PI * (1 - hour / 24));
  return { x: DIAL.cx + DIAL.r * Math.cos(theta), y: DIAL.cy - DIAL.r * Math.sin(theta) };
}

/** The hour a point in the viewBox stands for, clamped to the half circle. */
function hourAt(x: number, y: number): number {
  const dx = x - DIAL.cx;
  const up = DIAL.cy - y;
  const theta = up < 0 ? (dx >= 0 ? 0 : Math.PI) : Math.atan2(up, dx);
  return Math.min(HOUR_MAX, Math.max(HOUR_MIN, 24 * (1 - theta / Math.PI)));
}

export function SunDial(): React.JSX.Element {
  const moment = useView((s) => s.moment);
  const setMoment = useView((s) => s.setMoment);
  const svg = useRef<SVGSVGElement | null>(null);
  const [season, setSeason] = useState(false);

  const drag = (e: React.PointerEvent<SVGSVGElement>): void => {
    // Through the element's own matrix rather than its bounding box, so a
    // dial letterboxed by its aspect ratio still reads the pointer right.
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return;
    const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    // A quarter of an hour is as fine as this instrument pretends to be.
    setMoment({ hour: Math.round(hourAt(at.x, at.y) * 4) / 4 });
  };

  const onKey = (e: React.KeyboardEvent): void => {
    const by =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 0.25
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -0.25
          : e.key === 'PageUp'
            ? 1
            : e.key === 'PageDown'
              ? -1
              : 0;
    if (by !== 0) setMoment({ hour: moment.hour + by });
    else if (e.key === 'Home') setMoment({ hour: HOUR_MIN });
    else if (e.key === 'End') setMoment({ hour: HOUR_MAX });
    else return;
    e.preventDefault();
  };

  const sun = onArc(moment.hour);
  const reading = clock(moment.hour);

  return (
    <div className="dial">
      <svg
        ref={svg}
        className="dial-face"
        viewBox={`0 0 ${DIAL.width} ${DIAL.height}`}
        role="slider"
        tabIndex={0}
        aria-label="Hour of the day"
        aria-valuemin={HOUR_MIN}
        aria-valuemax={HOUR_MAX}
        aria-valuenow={Number(moment.hour.toFixed(2))}
        aria-valuetext={`${reading} local`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        <title>The day as a half circle: midnight at the left, noon at the top, midnight again at the right.</title>
        <defs>
          <linearGradient id="dial-day" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--ink-soft)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--sand)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <line className="dial-horizon" x1="6" y1={DIAL.cy} x2={DIAL.width - 6} y2={DIAL.cy} />
        <path
          className="dial-arc"
          d={`M ${DIAL.cx - DIAL.r} ${DIAL.cy} A ${DIAL.r} ${DIAL.r} 0 0 1 ${DIAL.cx + DIAL.r} ${DIAL.cy}`}
        />
        {[3, 6, 9, 12, 15, 18, 21].map((hour) => {
          const outer = onArc(hour);
          const inner = { x: DIAL.cx + (DIAL.r - (hour % 6 === 0 ? 11 : 6)) * ((outer.x - DIAL.cx) / DIAL.r), y: DIAL.cy + (DIAL.r - (hour % 6 === 0 ? 11 : 6)) * ((outer.y - DIAL.cy) / DIAL.r) };
          return <line key={hour} className="dial-tick" x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />;
        })}
        <line className="dial-ray" x1={DIAL.cx} y1={DIAL.cy} x2={sun.x} y2={sun.y} />
        <circle className="dial-sun-halo" cx={sun.x} cy={sun.y} r="10" />
        <circle className="dial-sun" cx={sun.x} cy={sun.y} r="5" />
      </svg>

      <div className="dial-readings">
        <output className="dial-readout">{reading}</output>
        <div className="dial-season">
          <button
            type="button"
            className="dial-date"
            aria-expanded={season}
            onClick={() => setSeason((open) => !open)}
            title="Set the day of the year"
          >
            {dateWords(moment.day)}
          </button>
          {season && <SeasonPopover onClose={() => setSeason(false)} />}
        </div>
      </div>
    </div>
  );
}

/**
 * The season, on the rare occasions a reader wants it: the four moments the
 * Blender views were rendered at, and the day of the year behind them.
 */
function SeasonPopover({ onClose }: { onClose: () => void }): React.JSX.Element {
  const moment = useView((s) => s.moment);
  const setMoment = useView((s) => s.setMoment);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const away = (e: PointerEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  return (
    <div
      className="popover"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        onClose();
        // Escape shuts the nearest thing first, so the drawer stays put.
        e.preventDefault();
      }}
    >
      <h3>Moment</h3>
      <ul className="moments">
        {MOMENTS.map((m) => {
          const chosen = m.moment.day === moment.day && m.moment.hour === moment.hour;
          return (
            <li key={m.id}>
              <button type="button" className={`moment${chosen ? ' is-chosen' : ''}`} onClick={() => setMoment(m.moment)}>
                <span>{m.label}</span>
                <span className="num">
                  {dateWords(m.moment.day)}, {clock(m.moment.hour)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <label className="field">
        <span className="field-label">
          Day of the year <output>{dateWords(moment.day)}</output>
        </span>
        <input
          type="range"
          min={DAY_MIN}
          max={DAY_MAX}
          step={1}
          value={moment.day}
          onChange={(e) => setMoment({ day: Number(e.target.value) })}
        />
      </label>
      <p className="note">
        The days are a common year's, so the presets read as the dates they were chosen for. The sun's real place for a day and an hour is
        the sky package's, not this dial's.
      </p>
    </div>
  );
}
