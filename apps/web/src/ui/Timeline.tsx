/**
 * The timeline: four stops on a rule, from the oldest reading of the plateau
 * to the one a surveyor could walk today. Each stop is a whole look for every
 * structure and carries the year the sky falls back to, so the rule reads
 * left to right as time and the caption above says what kind of thing each
 * stop is.
 *
 * It is a radio group, which is what it is: one of four, always one chosen.
 * The arrow keys move it while it has the focus, and they stop there, so the
 * tour's own arrows are left alone unless the reader is standing on the rule.
 */
import { useRef } from 'react';
import { useView } from '../store';
import { STATES, type StateId } from '../view';
import { yearWords } from './moment';

export function Timeline(): React.JSX.Element {
  const state = useView((s) => s.state);
  const setState = useView((s) => s.setState);
  const stops = useRef<Record<string, HTMLButtonElement | null>>({}).current;
  const index = STATES.findIndex((s) => s.id === state);

  const go = (to: number): void => {
    const stop = STATES[to];
    if (stop === undefined) return;
    setState(stop.id);
    stops[stop.id]?.focus();
  };

  const onKey = (e: React.KeyboardEvent): void => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = step === 0 ? (e.key === 'Home' ? 0 : e.key === 'End' ? STATES.length - 1 : -1) : index + step;
    if (to < 0 || to >= STATES.length) return;
    go(to);
    // The tour reads the same arrows off the window and stands down for a
    // keystroke already spoken for, which is what this says.
    e.preventDefault();
  };

  return (
    <div className="timeline" role="radiogroup" aria-label="Timeline" onKeyDown={onKey}>
      <div className="timeline-rule" aria-hidden="true">
        <span className="timeline-run" style={{ width: `${(index / (STATES.length - 1)) * 100}%` }} />
      </div>
      <ol className="timeline-stops">
        {STATES.map((stop) => (
          <li key={stop.id}>
            <Stop
              id={stop.id}
              label={stop.label}
              kind={stop.kind}
              epoch={stop.epoch}
              chosen={stop.id === state}
              hold={(el) => {
                stops[stop.id] = el;
              }}
              onChoose={() => setState(stop.id)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stop({
  id,
  label,
  kind,
  epoch,
  chosen,
  hold,
  onChoose,
}: {
  id: StateId;
  label: string;
  kind: string;
  epoch: number;
  chosen: boolean;
  hold: (el: HTMLButtonElement | null) => void;
  onChoose: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      ref={hold}
      role="radio"
      aria-checked={chosen}
      tabIndex={chosen ? 0 : -1}
      className={`stop${chosen ? ' is-chosen' : ''}`}
      onClick={onChoose}
      title={`${label}, ${yearWords(epoch)}, a ${kind}`}
    >
      <span className="stop-dot" aria-hidden="true" />
      <span className="stop-label">{label}</span>
      <span className="stop-epoch">{yearWords(epoch)}</span>
      <span className="stop-key" aria-hidden="true">
        {STATES.findIndex((s) => s.id === id) + 1}
      </span>
    </button>
  );
}
