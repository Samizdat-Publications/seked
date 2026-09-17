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
  DAY_MAX,
  DAY_MIN,
  DEFAULT_VIEW,
  HOUR_MAX,
  HOUR_MIN,
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
  type Moment,
  type Section,
  type SphinxVariant,
  type StateId,
  type View,
  stateById,
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
  /**
   * The footprint ids a loaded stand-in model stands in place of, published by
   * `scene/Standins.tsx` and read by `scene/Pyramids.tsx`, which leaves those
   * OSM prisms out. It follows what has loaded rather than what the reader
   * asked for, so it is not in the URL.
   */
  hiddenMasses: Set<string>;
  setHiddenMasses: (ids: Set<string>) => void;
  /**
   * What the viewer is still fetching, as ids of the form `kind:what`, which
   * the caption turns into its loading line. It is a property of the network
   * and not of the view, so it is not in the URL.
   */
  loading: Set<string>;
  setLoading: (id: string, on: boolean) => void;
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
  /**
   * Move the timeline. The sky follows the stop's own epoch unless the reader
   * has overridden it, which is the same rule opening a claim uses.
   */
  setState: (state: StateId) => void;
  setMoment: (moment: Partial<Moment>) => void;
  setSphinx: (sphinx: SphinxVariant | null) => void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const useView = create<ViewStore>((set, get) => ({
  ...DEFAULT_VIEW,
  cameraEpoch: 0,
  krupp: true,
  hiddenMasses: new Set<string>(),
  setHiddenMasses: (hiddenMasses) => set({ hiddenMasses }),
  loading: new Set<string>(),
  // A set is replaced rather than mutated, because a mutated one is the same
  // object and nothing subscribed would hear of it. Reporting what is already
  // reported changes nothing at all, which keeps a loader that calls this on
  // every retry from waking the caption.
  setLoading: (id, on) =>
    set((s) => {
      if (s.loading.has(id) === on) return {};
      const loading = new Set(s.loading);
      if (on) loading.add(id);
      else loading.delete(id);
      return { loading };
    }),
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
   * cut looking west, which is the view Petrie draws Plate I from. The
   * timeline goes to `built`, because the passages read best inside a whole
   * pyramid rather than inside a stepped core.
   */
  lookInside: (at, camera) =>
    set((s) => ({
      layers: { ...s.layers, pyramids: true, interior: true },
      state: 'built',
      epoch: s.epoch === null ? null : stateById('built').epoch,
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
  setState: (state) => set((s) => ({ state, epoch: s.epoch === null ? null : stateById(state).epoch })),
  setMoment: (moment) =>
    set((s) => {
      const next = { ...s.moment, ...moment };
      return { moment: { day: clamp(Math.round(next.day), DAY_MIN, DAY_MAX), hour: clamp(next.hour, HOUR_MIN, HOUR_MAX) } };
    }),
  setSphinx: (sphinx) => set({ sphinx }),
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
