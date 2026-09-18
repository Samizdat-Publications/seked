/**
 * The one handle the film has on React Three Fiber.
 *
 * The film draws its own frames: it steps the motion clock, waits until
 * everything the viewer was fetching is in, and then asks R3F to render
 * exactly one frame. That ask is `advance` off the R3F root store, and a root
 * store can only be had from inside the Canvas, where a DOM component such as
 * the Film drawer cannot mount. So the player that is already inside the
 * Canvas hands the store over here, in two lines at the top of
 * `scene/Motion.tsx`, and the drawer reads it back.
 *
 * Nothing in the scene reads this module and nothing here draws. It is a
 * letterbox, and it holds one letter.
 */
import type { RootStore } from '@react-three/fiber';

let held: RootStore | null = null;

/**
 * Called from inside the Canvas with the root store, and with null when that
 * Canvas goes away, so a film cannot be stepped against a dead renderer.
 */
export function setR3F(store: RootStore | null): void {
  held = store;
}

/** The R3F root store, or null when no Canvas is mounted. */
export function r3f(): RootStore | null {
  return held;
}
