import { useEffect } from 'react';
import { useView } from '../store';
import { TOUR } from '../tour';

/**
 * The tour, at the top of the panel because it is the first thing a stranger
 * needs and the first thing a reader who knows the model wants out of the
 * way. It draws the step and nothing else: the claim it opens, the layers and
 * the camera are the store's, so a reader can wander off mid-step and the
 * panel below carries on saying what the view now shows.
 */
export function Tour(): React.JSX.Element {
  const index = useView((s) => s.tour);
  const startTour = useView((s) => s.startTour);
  const nextStep = useView((s) => s.nextStep);
  const prevStep = useView((s) => s.prevStep);
  const endTour = useView((s) => s.endTour);
  const step = index === null ? undefined : TOUR[index];
  const running = step !== undefined;

  /**
   * The arrow keys step, which is what a reader reaches for, but only while
   * the tour is open and only when the keystroke was not meant for something
   * else: the same keys nudge the epoch and cubit sliders, and a slider under
   * the reader's finger keeps them.
   */
  useEffect(() => {
    if (!running) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const from = e.target as HTMLElement | null;
      if (from?.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(from?.tagName ?? '')) return;
      if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, nextStep, prevStep]);

  if (index === null || step === undefined) {
    return (
      <section className="block tour">
        <button type="button" className="step is-primary" onClick={startTour}>
          Take the tour
        </button>
        <p className="note">
          {TOUR.length} views, from what the model is built from to where the dossier is. It moves the controls below and nothing else, so
          you can step off it at any point.
        </p>
      </section>
    );
  }

  const last = index === TOUR.length - 1;
  return (
    <section className="block tour">
      <h2>
        Tour{' '}
        <span>
          {index + 1} of {TOUR.length}
        </span>
      </h2>
      <h3>{step.title}</h3>
      <p className="note">{step.text}</p>
      <p className="tour-buttons">
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
      <p className="note">The left and right arrow keys step as well.</p>
    </section>
  );
}
