/**
 * The view state, and the URL that mirrors it. One store, one subscription
 * that rewrites the query string; nothing else touches history, so a shared
 * link and the panel can never disagree.
 */
import { create } from 'zustand';
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
  setPreset: (preset: string) => void;
  setCubit: (cubit: number | null) => void;
  setEpoch: (epoch: number | null) => void;
  setLst: (lst: number) => void;
  toggleLayer: (id: LayerId) => void;
  setClaim: (claim: string | null) => void;
  setCamera: (camera: CameraView) => void;
  setMode: (mode: CameraMode) => void;
  setSpeed: (speed: number) => void;
  setSection: (section: Partial<Section>) => void;
  lookInside: (at: number, camera: CameraView) => void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const useView = create<ViewStore>((set) => ({
  ...DEFAULT_VIEW,
  cameraEpoch: 0,
  setPreset: (preset) => set({ preset }),
  setCubit: (cubit) => set({ cubit: cubit === null ? null : clamp(cubit, CUBIT_MIN, CUBIT_MAX) }),
  setEpoch: (epoch) => set({ epoch: epoch === null ? null : clamp(epoch, EPOCH_MIN, EPOCH_MAX) }),
  setLst: (lst) => set({ lst: normaliseLst(lst) }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  // Changing which claim is open gives the epoch back to the claims, so
  // opening a sky claim snaps the sky to the epoch that claim is stated at.
  setClaim: (claim) => set((s) => ({ claim: s.claim === claim ? null : claim, epoch: null })),
  setCamera: (camera) => set({ camera }),
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
