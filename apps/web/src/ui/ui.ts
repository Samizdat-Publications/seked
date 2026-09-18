/**
 * The shell's own state, which is not the view's. Which drawer stands open is
 * a property of the reader's desk and not of the plateau, so it is kept here
 * and deliberately left out of the URL: a shared link reproduces what is on
 * the screen, not which cupboard the sharer had open.
 */
import { create } from 'zustand';

export const DRAWERS = [
  { id: 'views', label: 'Views', hint: 'The hero cameras, each with its own moment' },
  { id: 'layers', label: 'Layers', hint: 'What is drawn and what is left out' },
  { id: 'claims', label: 'Claims', hint: 'Every claim, evaluated live against the survey' },
  { id: 'propose', label: 'Propose', hint: 'Put a claim to the model in your own words' },
  { id: 'section', label: 'Section', hint: 'Cut the masonry open, and how the camera moves' },
  { id: 'sky', label: 'Sky', hint: 'The epoch, the sidereal time and the named stars' },
  { id: 'tour', label: 'Tour', hint: 'A narrated way through the model' },
  { id: 'film', label: 'Film', hint: 'Record a sequence from the viewer, frame by frame' },
  { id: 'about', label: 'About', hint: 'What this is, and where its surfaces come from' },
] as const;

export type DrawerId = (typeof DRAWERS)[number]['id'];

export interface UiStore {
  /** The one drawer standing open, or null for the bare stage. */
  drawer: DrawerId | null;
  open: (drawer: DrawerId) => void;
  close: () => void;
  /** Open it, or shut it if it is the one already open. */
  toggle: (drawer: DrawerId) => void;
}

export const useUi = create<UiStore>((set) => ({
  drawer: null,
  open: (drawer) => set({ drawer }),
  close: () => set({ drawer: null }),
  toggle: (drawer) => set((s) => ({ drawer: s.drawer === drawer ? null : drawer })),
}));
