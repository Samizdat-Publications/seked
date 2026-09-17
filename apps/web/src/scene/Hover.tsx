/**
 * What the pointer is resting on, and what kind of thing it is.
 *
 * The honesty rules say that a reader should never have to guess whether what
 * they are looking at is survey, a reconstruction or a claim. The caption says
 * it for the view as a whole; this says it for one structure at a time, which
 * is what matters once a state holds survey pyramids, reconstructed temples
 * and a claimed Anubis in the same frame.
 *
 * The tag every mesh carries is `userData.seked = { name, tier, note, state }`,
 * set by whichever component built it. Nothing is registered here and nothing
 * has to be unregistered: a component that mounts a mesh with a tag on it is
 * named from the next pointer move, and one that unmounts stops being named
 * the same way.
 *
 * Two things keep this cheap. The candidates are gathered by walking the scene
 * for tagged objects rather than raycasting it whole, so the terrain's hundred
 * thousand triangles are never tested; and the ray is cast at thirty hertz
 * rather than once per pointer event, which on a trackpad can be a hundred and
 * fifty.
 *
 * The label itself is DOM, in `ui/HoverTag.tsx`. A sprite would have to be
 * drawn in the scene's own tone curve, would bloom, and could not use the
 * shell's typefaces; a glass tag beside the pointer is what the design asks
 * for. This file finds what is under the pointer and says so through a small
 * store; that file draws it.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Raycaster, Vector2, type Object3D } from 'three';
import { create } from 'zustand';

/** The tag a mesh carries. `state` is the timeline stop it belongs to, which the dissolve reads. */
export interface SekedTag {
  name: string;
  /** survey, excavated, instrumented, claimed, reconstruction or stand-in. */
  tier: string;
  /** Where it comes from, or what it stands in for. The first sentence is shown. */
  note?: string;
  state?: string;
}

export interface Hovered extends SekedTag {
  /** Where the pointer was, in CSS pixels from the top left of the window. */
  x: number;
  y: number;
}

interface HoverStore {
  hovered: Hovered | null;
  setHovered: (hovered: Hovered | null) => void;
}

/** What the pointer is on. Not in the URL: it is the mouse, not the view. */
export const useHover = create<HoverStore>((set) => ({
  hovered: null,
  setHovered: (hovered) => set({ hovered }),
}));

/** Milliseconds between rays. A look choice: thirty hertz is under a frame's worth of delay. */
const INTERVAL_MS = 1000 / 30;

/**
 * How many rays in a row have to agree before the tag changes. Two: one frame
 * of disagreement is the pointer crossing a seam between two meshes, and a tag
 * that swapped on it would flicker where a reader is trying to read it.
 */
const HYSTERESIS = 2;

/** How often the list of tagged objects is rebuilt, in milliseconds. */
const RESCAN_MS = 400;

/** The tag on an object or on the nearest ancestor that has one. */
function tagOf(object: Object3D): SekedTag | undefined {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const tag = node.userData.seked as SekedTag | undefined;
    if (tag?.name) return tag;
  }
  return undefined;
}

/** Every object carrying a tag, which is everything the ray has to be cast at. */
function tagged(root: Object3D): Object3D[] {
  const found: Object3D[] = [];
  root.traverse((object) => {
    if ((object.userData.seked as SekedTag | undefined)?.name) found.push(object);
  });
  return found;
}

/**
 * The first sentence of a note, so the tag keeps to three lines however long
 * an attribution is. The whole of it belongs in the About drawer.
 */
export function firstSentence(text: string, limit = 96): string {
  const stop = /[.!?](\s|$)/.exec(text);
  const sentence = stop ? text.slice(0, stop.index + 1) : text;
  if (sentence.length <= limit) return sentence;
  const cut = sentence.slice(0, limit);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), limit - 12))}...`;
}

/** Mounts in the scene. Draws nothing; it only says what the pointer is on. */
export function Hover(): null {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setHovered = useHover((s) => s.setHovered);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  // The pointer in CSS pixels, which is where the tag goes, and in normalised
  // device coordinates, which is what the ray wants. R3F keeps the second for
  // its own events; the first it does not, and the tag is DOM.
  const pointer = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const candidates = useRef<{ list: Object3D[]; at: number }>({ list: [], at: 0 });
  const proposed = useRef<{ tag: SekedTag | null; runs: number }>({ tag: null, runs: 0 });
  const shown = useRef<SekedTag | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const element = gl.domElement;
    const move = (event: PointerEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY, inside: true };
    };
    const leave = (): void => {
      pointer.current.inside = false;
      shown.current = null;
      proposed.current = { tag: null, runs: 0 };
      setHovered(null);
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      setHovered(null);
    };
  }, [gl, setHovered]);

  useFrame(() => {
    const now = performance.now();
    if (now - last.current < INTERVAL_MS) return;
    last.current = now;
    const at = pointer.current;
    if (!at.inside) return;

    if (now - candidates.current.at > RESCAN_MS) {
      candidates.current = { list: tagged(scene), at: now };
    }
    let found: SekedTag | null = null;
    if (candidates.current.list.length > 0) {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((at.x - rect.left) / rect.width) * 2 - 1, -(((at.y - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(candidates.current.list, true)[0];
      found = hit ? (tagOf(hit.object) ?? null) : null;
    }

    // The tag only changes once the same answer has come back twice, so a
    // pointer sliding along the seam between two mastabas does not strobe.
    if (found?.name === proposed.current.tag?.name) proposed.current.runs += 1;
    else proposed.current = { tag: found, runs: 1 };
    if (proposed.current.runs >= HYSTERESIS && proposed.current.tag?.name !== shown.current?.name) {
      shown.current = proposed.current.tag;
    }
    const tag = shown.current;
    // Nothing under the pointer is the common case, and publishing it again
    // every thirty-third of a second would re-render the tag for no reason.
    if (tag === null) {
      if (useHover.getState().hovered !== null) setHovered(null);
      return;
    }
    setHovered({ ...tag, x: at.x, y: at.y });
  });

  return null;
}
