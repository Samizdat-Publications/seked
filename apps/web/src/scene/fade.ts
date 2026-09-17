/**
 * The dissolve between the timeline's stops.
 *
 * Moving the timeline swaps one whole plateau for another: cased pyramids for
 * stepped cores, whole temples for low walls, one Sphinx for the next. Cutting
 * between them is a jump cut, and a jump cut reads as a bug. A dissolve reads
 * as time passing, which is what the timeline is about.
 *
 * Two decisions hold this file up.
 *
 * The first is that no component fades itself. Every state-dependent component
 * renders exactly one state and knows nothing about the one before it; the
 * fade is applied from outside, by walking the scene each frame and setting
 * the opacity of whatever is found there. That keeps four tracks' components
 * free of a shared animation clock and means a component added later is
 * dissolved without being told.
 *
 * The second is that the blend is an alpha hash and not sorted transparency.
 * Turning a plateau of overlapping stone transparent for eight tenths of a
 * second would sort it wrongly, show the inside of every casing and cost a
 * render pass; the hash instead discards a fragment when a per-pixel random
 * number beats its alpha, which stipples the stone away with the depth buffer
 * still doing its job. At a distance the stipple is invisible and the stone
 * simply thins out.
 *
 * What is drawn is found by the tag `userData.seked`, which every
 * state-dependent mesh in the scene carries (`{ name, tier, note, state }`).
 * Objects tagged with the stop being left fade out; objects tagged with the
 * stop being arrived at fade in; anything untagged, such as the ground, is a
 * fixture of every state and is left alone. When nothing in the scope is
 * tagged at all, which is what the scene looked like before the other tracks
 * landed, the whole group dips out and back instead: no cooperation is needed
 * and it still reads as a dissolve.
 *
 * The one hard rule is the last line of every frame: a material this file has
 * touched is put back exactly as it was found, alpha hash off and opacity
 * restored, the moment it stops being part of a running dissolve. That holds
 * when a second change of state lands halfway through the first, because what
 * should be fading is recomputed from scratch every frame and anything no
 * longer in that set is restored the same frame.
 */
import { useFrame } from '@react-three/fiber';
import { createElement, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Group, type Material, type Object3D } from 'three';
import { useView } from '../store';
import type { StateId } from '../view';

/**
 * How long the dissolve takes, in seconds. A look choice: the spec asks for
 * about a second, and eight tenths is long enough to read as a change of
 * world and short enough that a reader stepping along the timeline with the
 * number keys is not kept waiting.
 */
export const DISSOLVE_SECONDS = 0.8;

/** A dissolve in progress, or a finished one with `t` at 1. */
export interface Transition {
  /** The stop being left, or null when nothing is dissolving. */
  from: StateId | null;
  /** The stop the timeline is on now. */
  to: StateId;
  /** 0 the instant the timeline moved, 1 when the dissolve has finished. */
  t: number;
}

/**
 * The running dissolve. The object is the same one every frame and its fields
 * are written in place, because a value that changed sixty times a second
 * through React would re-render the scene sixty times a second to animate
 * something no React component draws. Read it inside `useFrame`, not in a
 * render body.
 *
 * The hook subscribes to the clock before its caller does, so a caller that
 * calls this first and then its own `useFrame` sees a `t` already advanced for
 * the frame it is drawing.
 */
export function useStateTransition(): Transition {
  const state = useView((s) => s.state);
  const live = useRef<Transition>({ from: null, to: state, t: 1 }).current;
  // A change landing part way through a dissolve takes the stop that was on
  // its way in as the one now on its way out, which is what the eye is
  // looking at, and restarts the clock.
  if (live.to !== state) {
    live.from = live.to;
    live.to = state;
    live.t = 0;
  }
  useFrame((_, delta) => {
    if (live.t >= 1) return;
    live.t = Math.min(1, live.t + delta / DISSOLVE_SECONDS);
    if (live.t >= 1) live.from = null;
  });
  return live;
}

/**
 * How opaque an object should be drawn, for the stop it belongs to, part way
 * through a dissolve.
 *
 * `tagged` says whether anything in the scope has declared which stop it
 * belongs to. When something has, an object of the stop being arrived at comes
 * up from nothing, an object of any other stop goes out, and an untagged
 * object, which is a fixture of every state such as the ground, is left alone.
 * When nothing has, the whole scope dips instead: out over the first half of
 * the dissolve and back over the second, which needs no cooperation from
 * anyone and still reads as a dissolve.
 */
export function fadeAlpha(stop: string | undefined, transition: Transition, tagged: boolean): number {
  const { t, to } = transition;
  if (t >= 1) return 1;
  if (!tagged) return Math.abs(2 * t - 1);
  if (stop === undefined) return 1;
  return stop === to ? t : 1 - t;
}

/** What a material looked like before the dissolve touched it. */
interface Dressed {
  transparent: boolean;
  opacity: number;
  alphaHash: boolean;
}

/** The tag every state-dependent mesh carries, as far as this file cares. */
interface SekedTag {
  state?: string;
}

/**
 * Which stop an object belongs to: its own tag, or the nearest tagged
 * ancestor's, so a stand-in tagged at its root carries the whole model.
 * `stop` bounds the walk, which keeps it off the rest of the scene graph.
 */
function stopOf(object: Object3D, stop: Object3D): string | undefined {
  for (let node: Object3D | null = object; node && node !== stop.parent; node = node.parent) {
    const tag = node.userData.seked as SekedTag | undefined;
    if (tag?.state !== undefined) return tag.state;
  }
  return undefined;
}

function materialsOf(object: Object3D): Material[] {
  const held = (object as { material?: Material | Material[] }).material;
  if (!held) return [];
  return Array.isArray(held) ? held : [held];
}

/** Put a material at `alpha`, remembering what it was the first time. */
function dress(material: Material, alpha: number, touched: Map<Material, Dressed>): void {
  let was = touched.get(material);
  if (!was) {
    was = { transparent: material.transparent, opacity: material.opacity, alphaHash: material.alphaHash };
    touched.set(material, was);
  }
  // A material that was already blending, such as a sprite's, keeps doing so:
  // the hash is for the opaque stone, which is everything else.
  if (!was.transparent && !material.alphaHash) {
    material.alphaHash = true;
    // Three compiles the hash in rather than branching on it, so turning it on
    // is a recompile. It happens twice a dissolve, not once a frame.
    material.needsUpdate = true;
  }
  material.opacity = was.opacity * alpha;
}

/** Put a material back exactly as it was found. */
function undress(material: Material, was: Dressed): void {
  material.opacity = was.opacity;
  if (material.alphaHash !== was.alphaHash) {
    material.alphaHash = was.alphaHash;
    material.needsUpdate = true;
  }
}

/**
 * Wraps the part of the scene the timeline changes, and dissolves it. Put it
 * around the plateau rather than around the sky: fading the sky out would be a
 * flash of the background rather than a change of era, and the sky's own
 * epoch is already following the stop.
 *
 * The group it renders is an identity transform. It exists so that the walk
 * has a root and stops there. It is written with `createElement` rather than
 * as JSX only so that this stays the `fade.ts` the plan names.
 */
export function FadeScope({ children }: { children: ReactNode }): React.JSX.Element {
  const transition = useStateTransition();
  const scope = useRef<Group>(null);
  const touched = useMemo(() => new Map<Material, Dressed>(), []);
  const wanted = useMemo(() => new Map<Material, number>(), []);

  // Whatever else happens, nothing leaves this component stippled.
  useEffect(
    () => () => {
      for (const [material, was] of touched) undress(material, was);
      touched.clear();
    },
    [touched],
  );

  useFrame(() => {
    const root = scope.current;
    if (!root) return;
    wanted.clear();
    if (transition.t < 1) {
      // One walk to find out whether anyone has said what belongs to which
      // stop, and to collect the materials either way.
      let tagged = false;
      const found: { material: Material; stop: string | undefined }[] = [];
      root.traverse((object) => {
        const materials = materialsOf(object);
        if (materials.length === 0) return;
        const stop = stopOf(object, root);
        if (stop !== undefined) tagged = true;
        for (const material of materials) found.push({ material, stop });
      });
      for (const { material, stop } of found) {
        const alpha = fadeAlpha(stop, transition, tagged);
        // A material shared by two objects of different stops takes the
        // fainter of the two, because whichever is going out should go.
        if (alpha < 1) wanted.set(material, Math.min(wanted.get(material) ?? 1, alpha));
      }
    }
    for (const [material, was] of touched) {
      if (wanted.has(material)) continue;
      undress(material, was);
      touched.delete(material);
    }
    for (const [material, alpha] of wanted) dress(material, alpha, touched);

  });

  return createElement('group', { ref: scope }, children);
}
