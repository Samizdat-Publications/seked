/**
 * The view state, and the URL that mirrors it. One store, one subscription
 * that rewrites the query string; nothing else touches history, so a shared
 * link and the panel can never disagree.
 */
import { create } from 'zustand';
import { TOUR, applyStep } from './tour';
import {
  CUBIT_MAX,
  CUBIT_MIN,
  DEFAULT_VIEW,
  EPOCH_MAX,
  EPOCH_MIN,
  SECTION_MAX,
  SECTION_MIN,
  SPEED_MAX,
  SPEED_MIN,
  decodeView,
  encodeView,
  normaliseLst,
  type CameraMode,
  type CameraView,
  type LayerId,
  type Section,
  type View,
} from './view';

export interface ViewStore extends View {
  /**
   * Bumped whenever something other than the controls moves the camera, which
   * is how the orbit controls know to adopt a view the panel set rather than
   * one they produced themselves.
   */
  cameraEpoch: number;
  /**
   * C4's free choice: whether the sky is laid on the plateau north to north
   * or with north and south swapped, which is Krupp's objection to the Orion
   * Correlation. It is a property of one overlay rather than of the view, so
   * it is not in the URL.
   */
  krupp: boolean;
  setPreset: (preset: string) => void;
  setCubit: (cubit: number | null) => void;
  setEpoch: (epoch: number | null) => void;
  setLst: (lst: number) => void;
  toggleKrupp: () => void;
  toggleLayer: (id: LayerId) => void;
  setClaim: (claim: string | null) => void;
  setCamera: (camera: CameraView) => void;
  /**
   * Move the camera and have the orbit controls adopt it, which is the part
   * `setCamera` deliberately leaves out: the controls call that one on every
   * frame of a drag, and a bump there would fight them.
   */
  showCamera: (camera: CameraView) => void;
  setMode: (mode: CameraMode) => void;
  setSpeed: (speed: number) => void;
  setSection: (section: Partial<Section>) => void;
  lookInside: (at: number, camera: CameraView) => void;
  /** Open the tour at its first step. */
  startTour: () => void;
  /** The next step, or the end of the tour when there is no next one. */
  nextStep: () => void;
  prevStep: () => void;
  /** Close the tour and leave the reader with the view the last step set. */
  endTour: () => void;
  goToStep: (index: number) => void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const useView = create<ViewStore>((set, get) => ({
  ...DEFAULT_VIEW,
  cameraEpoch: 0,
  krupp: true,
  setPreset: (preset) => set({ preset }),
  setCubit: (cubit) => set({ cubit: cubit === null ? null : clamp(cubit, CUBIT_MIN, CUBIT_MAX) }),
  setEpoch: (epoch) => set({ epoch: epoch === null ? null : clamp(epoch, EPOCH_MIN, EPOCH_MAX) }),
  setLst: (lst) => set({ lst: normaliseLst(lst) }),
  toggleKrupp: () => set((s) => ({ krupp: !s.krupp })),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  // Changing which claim is open gives the epoch back to the claims, so
  // opening a sky claim snaps the sky to the epoch that claim is stated at.
  setClaim: (claim) => set((s) => ({ claim: s.claim === claim ? null : claim, epoch: null })),
  setCamera: (camera) => set({ camera }),
  showCamera: (camera) => set((s) => ({ camera, cameraEpoch: s.cameraEpoch + 1 })),
  setMode: (mode) => set({ mode }),
  setSpeed: (speed) => set({ speed: clamp(speed, SPEED_MIN, SPEED_MAX) }),
  setSection: (section) =>
    set((s) => {
      const next = { ...s.section, ...section };
      return { section: { ...next, at: clamp(next.at, SECTION_MIN, SECTION_MAX) } };
    }),
  /**
   * The one compound move: open the Great Pyramid. Cut the north-south plane
   * through the passages, show the interior, and put the camera east of the
   * cut looking west, which is the view Petrie draws Plate I from.
   */
  lookInside: (at, camera) =>
    set((s) => ({
      layers: { ...s.layers, pyramids: true, interior: true, today: false },
      section: { on: true, axis: 'ns', at: clamp(at, SECTION_MIN, SECTION_MAX), ground: false },
      mode: 'orbit',
      camera,
      cameraEpoch: s.cameraEpoch + 1,
    })),
  /**
   * The tour drives the actions above and adds nothing of its own, so every
   * step is a state a reader could have reached by hand and the address bar
   * mirrors it the same way. An index with no step leaves the view alone.
   */
  startTour: () => get().goToStep(0),
  nextStep: () => {
    const { tour } = get();
    if (tour === null) return;
    if (tour + 1 < TOUR.length) get().goToStep(tour + 1);
    else get().endTour();
  },
  prevStep: () => {
    const { tour } = get();
    if (tour !== null && tour > 0) get().goToStep(tour - 1);
  },
  endTour: () => set({ tour: null }),
  goToStep: (index) => {
    const step = TOUR[index];
    if (!step) return;
    applyStep(step, get());
    set({ tour: index });
  },
}));

/** Adopt the view in the address bar. Call once, before the first render. */
export function readUrl(presetIds: string[]): void {
  useView.setState(decodeView(window.location.search, presetIds));
}

/**
 * Keep the address bar in step. The camera moves every frame while a reader
 * drags or flies, so writes are coalesced; replaceState keeps the back button
 * for leaving the page rather than for undoing an orbit.
 */
export function mirrorUrl(): () => void {
  let timer: number | undefined;
  const write = (state: View): void => {
    const query = encodeView(state);
    if (query !== window.location.search) window.history.replaceState(null, '', query);
  };
  const unsubscribe = useView.subscribe((state) => {
    if (timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      write(useView.getState());
    }, 200);
  });
  write(useView.getState());
  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    unsubscribe();
  };
}
