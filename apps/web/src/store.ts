/**
 * The view state, and the URL that mirrors it. One store, one subscription
 * that rewrites the query string; nothing else touches history, so a shared
 * link and the panel can never disagree.
 */
import { create } from 'zustand';
import { CUBIT_MAX, CUBIT_MIN, DEFAULT_VIEW, decodeView, encodeView, type CameraView, type LayerId, type View } from './view';

export interface ViewStore extends View {
  setPreset: (preset: string) => void;
  setCubit: (cubit: number | null) => void;
  toggleLayer: (id: LayerId) => void;
  setClaim: (claim: string | null) => void;
  setCamera: (camera: CameraView) => void;
}

const clamp = (v: number): number => Math.min(CUBIT_MAX, Math.max(CUBIT_MIN, v));

export const useView = create<ViewStore>((set) => ({
  ...DEFAULT_VIEW,
  setPreset: (preset) => set({ preset }),
  setCubit: (cubit) => set({ cubit: cubit === null ? null : clamp(cubit) }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setClaim: (claim) => set((s) => ({ claim: s.claim === claim ? null : claim })),
  setCamera: (camera) => set({ camera }),
}));

/** Adopt the view in the address bar. Call once, before the first render. */
export function readUrl(presetIds: string[]): void {
  useView.setState(decodeView(window.location.search, presetIds));
}

/**
 * Keep the address bar in step. The camera moves every frame while a reader
 * drags, so writes are coalesced; replaceState keeps the back button for
 * leaving the page rather than for undoing an orbit.
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
