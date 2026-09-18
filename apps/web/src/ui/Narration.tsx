/**
 * The narration band: what the shot on screen is saying, across the bottom of
 * the stage above the instruments.
 *
 * It shows whenever a sequence with words is loaded, which is the tour and
 * not the film presets, and it goes again the moment one is not. It reads the
 * motion store for what it shows and drives nothing: the shot it is narrating
 * is already being played through the view store by the player, and the scene
 * never looks this way at all.
 *
 * The band takes no pointer events, so a reader can go on dragging the
 * plateau around underneath their own narration.
 */
import { useEffect, useRef } from 'react';
import { useMotion } from '../motion/store';

export function Narration(): React.JSX.Element | null {
  const sequence = useMotion((s) => s.sequence);
  const index = useMotion((s) => s.shot);
  const bar = useRef<HTMLSpanElement>(null);
  const shot = sequence?.shots[index];

  /**
   * The rule fills as the shot runs, which is a value that changes every
   * frame. Subscribing to it here and writing the element's own transform
   * keeps that out of React: a re-render a frame for a progress bar would
   * cost the scene more than the bar is worth.
   */
  useEffect(
    () =>
      useMotion.subscribe((motion) => {
        const running = motion.sequence?.shots[motion.shot];
        if (!bar.current || !running) return;
        const fraction = running.seconds > 0 ? Math.min(1, motion.time / running.seconds) : 1;
        bar.current.style.transform = `scaleX(${fraction})`;
      }),
    [],
  );

  if (!sequence || !shot || !shot.text) return null;

  return (
    <aside className="narration" aria-live="polite">
      {/*
        Keyed on the shot, so React replaces the block at a cut rather than
        editing it in place and the fade below runs again for each shot.
      */}
      <div className="narration-body" key={shot.id}>
        {shot.title ? <h2 className="narration-title">{shot.title}</h2> : null}
        <p className="narration-text">{shot.text}</p>
      </div>
      <p className="narration-foot">
        <span className="narration-rule" aria-hidden="true">
          <span className="narration-rule-fill" ref={bar} />
        </span>
        <span className="narration-count num">
          {index + 1} of {sequence.shots.length}
        </span>
      </p>
    </aside>
  );
}
