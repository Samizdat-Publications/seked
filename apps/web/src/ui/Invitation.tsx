/**
 * The way in.
 *
 * The tour was already eleven shots with narration on the stage, but it was
 * behind a button in a drawer, so what a reader met on opening was an empty
 * plateau and thirty controls. That is a sandbox, and Stewart's 2026-09-19
 * direction is an exhibit: a guided walk through a set of framed scenes that
 * somebody who has never heard of a seked can follow, with the claims laid
 * over it. So the first thing on the stage is the invitation to take it.
 *
 * It is an invitation and not a gate. The dismissal is remembered, arriving
 * on a shared link skips it, and the whole of the viewer is reachable without
 * ever touching it, because a reader who came for the dossier should not have
 * to sit through a walk to get there.
 */
import { useEffect, useState } from 'react';
import { useMotion } from '../motion/store';
import { useView } from '../store';
import { TOUR, TOUR_STEPS } from '../tour';

/**
 * Remembered per browser, so the invitation is a first meeting rather than
 * something to dismiss on every visit. Browser storage can throw outright
 * where site data is blocked, so every touch of it is guarded and a failure
 * means the invitation simply shows again.
 */
const SEEN = 'seked.invitation.seen';

/**
 * Whether the page was opened on somebody's link, read at module load because
 * the view store rewrites the query string the moment it mounts.
 */
const ARRIVED_SHARED = typeof window !== 'undefined' && window.location.search.length > 1;

function rememberedSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(SEEN, '1');
  } catch {
    /* A reader with site data blocked meets the invitation again. That is the
       lesser fault of the two available. */
  }
}

export function Invitation(): React.JSX.Element | null {
  const running = useMotion((s) => s.sequence?.id === TOUR.id);
  const startTour = useView((s) => s.startTour);
  const [dismissed, setDismissed] = useState(true);

  /**
   * Decided once, on mount, and never from the render path: a reader who has
   * been here before, or who followed somebody's link to a particular view,
   * is not shown the front door.
   *
   * A link is recognised by the query string, and it has to be the one the
   * page was opened with rather than the one it has by the time this runs.
   * `store.ts` calls `replaceState` with the encoded view as soon as it
   * mounts, so every visit has a full query string a moment later and the
   * test would never be false. `ARRIVED_SHARED` is read at module load, which
   * is before any of that, the same way `Scene.tsx` reads `?still=1`.
   */
  useEffect(() => {
    setDismissed(ARRIVED_SHARED || rememberedSeen());
  }, []);

  if (dismissed || running) return null;

  const close = (): void => {
    remember();
    setDismissed(true);
  };

  return (
    <aside className="invitation" aria-label="Welcome">
      <div className="invitation-body">
        <p className="invitation-eyebrow">Giza, surveyed and reconstructed</p>
        <h2 className="invitation-title">Take the walkthrough</h2>
        <p className="invitation-text">
          {TOUR_STEPS.length} scenes across four states of the plateau, from the survey the model is built on to the claims tested against
          it. Every number on screen comes from a cited measurement, and where a reconstruction begins it says so.
        </p>
        <p className="invitation-buttons">
          <button
            type="button"
            className="step is-primary"
            onClick={() => {
              remember();
              setDismissed(true);
              startTour();
            }}
          >
            Begin the walkthrough
          </button>
          <button type="button" className="link" onClick={close}>
            Explore on my own
          </button>
        </p>
      </div>
    </aside>
  );
}
