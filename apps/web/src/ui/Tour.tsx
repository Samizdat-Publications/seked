/**
 * The Tour drawer: the handle on the sequence, not the sequence itself.
 *
 * The words are on the stage in the narration band, because a tour with its
 * narration in a shut cupboard is a slideshow. What is here is the transport
 * and the running order: play and pause, back and next, out, and every shot
 * by its title so a reader can jump. The film presets are not here; the Film
 * drawer lists those.
 *
 * It reads the motion store for what is playing and drives the view store's
 * own tour actions, so a reader can wander off mid-shot and the panels below
 * carry on saying what the view now shows.
 */
import { useEffect } from 'react';
import { useMotion } from '../motion/store';
import { useView } from '../store';
import { TOUR, TOUR_STEPS } from '../tour';

/** Whether a keystroke was meant for something the reader is typing in. */
function typing(target: EventTarget | null): boolean {
  const from = target as HTMLElement | null;
  return Boolean(from?.isContentEditable) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(from?.tagName ?? '');
}

export function Tour(): React.JSX.Element {
  const index = useView((s) => s.tour);
  const running = useMotion((s) => s.sequence?.id === TOUR.id);
  const playing = useMotion((s) => s.playing);
  const startTour = useView((s) => s.startTour);
  const nextStep = useView((s) => s.nextStep);
  const prevStep = useView((s) => s.prevStep);
  const endTour = useView((s) => s.endTour);
  const goToStep = useView((s) => s.goToStep);

  /**
   * The arrow keys step and space holds, which is what a reader reaches for,
   * but only while the tour is running and only when the keystroke was not
   * meant for something else: the same keys nudge the epoch and cubit
   * sliders, and a slider under the reader's finger keeps them. Space over a
   * button is the button's, since the browser turns that one into a click.
   */
  useEffect(() => {
    if (!running) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const motion = useMotion.getState();
      if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
      else if (e.key === ' ' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        if (motion.playing) motion.pause();
        else motion.resume();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, nextStep, prevStep]);

  if (!running || index === null) {
    return (
      <section className="block tour">
        <button type="button" className="step is-primary" onClick={startTour}>
          Take the tour
        </button>
        <p className="note">
          {TOUR_STEPS.length} shots through the eras, from what the model is built from to where the dossier is. It moves the camera, the
          timeline and the controls below and nothing else, so you can step off it at any point.
        </p>
      </section>
    );
  }

  const last = index === TOUR_STEPS.length - 1;
  return (
    <section className="block tour">
      <h2>
        Tour{' '}
        <span>
          {index + 1} of {TOUR_STEPS.length}
        </span>
      </h2>
      <p className="tour-buttons">
        <button type="button" className="step" onClick={() => (playing ? useMotion.getState().pause() : useMotion.getState().resume())}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="step" onClick={prevStep} disabled={index === 0}>
          Back
        </button>
        <button type="button" className="step is-primary" onClick={nextStep}>
          {last ? 'Finish' : 'Next'}
        </button>
        <button type="button" className="link" onClick={endTour}>
          End tour
        </button>
      </p>
      <ol className="tour-list">
        {TOUR_STEPS.map((shot, i) => (
          <li key={shot.id}>
            <button
              type="button"
              className={`tour-shot${i === index ? ' is-showing' : ''}`}
              onClick={() => goToStep(i)}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="tour-shot-number num">{i + 1}</span>
              <span className="tour-shot-title">{shot.title ?? shot.id}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="note">The left and right arrow keys step, and space holds the shot where it is.</p>
    </section>
  );
}
