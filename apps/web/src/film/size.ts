/**
 * The frame's own size, which is not the window's.
 *
 * A film is asked for at 1920 by 1080 or at 3840 by 2160, and the reader's
 * window is whatever it is. What has to come out exactly right is the drawing
 * buffer: the canvas's `width` and `height` attributes, which is what a
 * `VideoFrame` is cut from and what the encoder is configured for. A buffer
 * one pixel out is a file the encoder refuses.
 *
 * Three ways of getting there, and only the third survives the composer.
 * Resizing the window is not ours to do. Drawing to an offscreen target would
 * leave the post chain, which is where most of the look is, drawing at the
 * window's size. So the canvas keeps drawing the picture and the size is made
 * out of two numbers R3F already owns: the CSS box, which the stage is given
 * a fixed aspect for so it cannot be the wrong shape, and the device pixel
 * ratio, set so that the box times the ratio is the size asked for. Three
 * multiplies the two and the composer follows the renderer, so everything
 * downstream lands on it without being told.
 *
 * The quarter pixel below is the whole trick. `WebGLRenderer.setSize` floors
 * the product, so aiming exactly at 1920 can floor to 1919 on a float that
 * came out a hair light; aiming a quarter of a pixel over cannot, and cannot
 * reach 1921 either.
 */
import type { RootStore } from '@react-three/fiber';

/** How far over the wanted size the CSS box aims, in device pixels. */
export const OVERSHOOT = 0.25;

/** The pixel ratio at which a CSS box this wide draws exactly `width` pixels. */
export function dprFor(cssWidth: number, width: number): number {
  return (width + OVERSHOOT) / cssWidth;
}

/** The CSS box, in CSS pixels, that draws exactly `width` by `height` at this ratio. */
export function cssSizeFor(width: number, height: number, dpr: number): { width: number; height: number } {
  return { width: (width + OVERSHOOT) / dpr, height: (height + OVERSHOOT) / dpr };
}

export interface HeldSize {
  /** The ratio the run is drawing at, for the record. */
  dpr: number;
  /**
   * Put the exact buffer back if anything has moved it. Anything does: a
   * re-render of the Canvas has R3F measure the container and set the size
   * from it again, and a shot that changes the camera mode re-renders the
   * Canvas. Called before every frame, and does nothing at all when the
   * buffer is already right.
   */
  hold: () => void;
  /** The window's own size back, and the stage out of its box. */
  restore: () => void;
}

const nextFrame = (): Promise<void> => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Put the stage in a box of the film's aspect and the canvas at the film's
 * size. Restore both when the run is over.
 */
export async function holdSize(root: RootStore, stage: HTMLElement, width: number, height: number): Promise<HeldSize> {
  const was = { size: { ...root.getState().size }, dpr: root.getState().viewport.dpr, ratio: stage.style.getPropertyValue('--film-ratio') };

  stage.style.setProperty('--film-ratio', String(width / height));
  stage.classList.add('is-film-frame');
  // One turn of the loop for the browser to lay the box out, so the measure
  // below is of the box and not of what was there before it.
  await nextFrame();

  const box = stage.getBoundingClientRect();
  if (box.width < 1) throw new Error('The film has no stage to draw on.');
  const dpr = dprFor(box.width, width);
  const css = cssSizeFor(width, height, dpr);

  const apply = (): void => {
    const state = root.getState();
    state.setDpr(dpr);
    state.setSize(css.width, css.height);
  };
  apply();

  return {
    dpr,
    hold: () => {
      const canvas = root.getState().gl.domElement;
      if (canvas.width !== width || canvas.height !== height) apply();
    },
    restore: () => {
      stage.classList.remove('is-film-frame');
      if (was.ratio) stage.style.setProperty('--film-ratio', was.ratio);
      else stage.style.removeProperty('--film-ratio');
      const state = root.getState();
      state.setDpr(was.dpr);
      state.setSize(was.size.width, was.size.height, was.size.top, was.size.left);
    },
  };
}
