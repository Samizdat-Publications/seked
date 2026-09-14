/**
 * The dome, as buffers. Nothing here touches three or React: it turns the
 * bundled catalogue into positions, colours and sizes, so the component that
 * draws it has no astronomy in it and this file can be read on its own.
 *
 * The stars are built in equatorial coordinates of date, not in the horizon
 * frame. Sidereal time does not move the stars with respect to each other, it
 * turns the whole sphere about the celestial pole, so the buffer is rebuilt
 * only when the epoch changes and the sidereal-time control is a rotation of
 * one object. `equatorialToHorizon` in @seked/sky is that rotation.
 */
import { positionsAtEpoch, sphericalToVec, type BrightStar, type Equatorial, type Star } from '@seked/sky/browser';

/**
 * How far away the dome is drawn, in metres. Far enough that the plateau and
 * the pyramids sit well inside it, near enough to stay inside the camera's
 * far plane at 40 km.
 */
export const DOME_RADIUS = 9000;

/** The dome as three buffers plus a count, ready for one points object. */
export interface DomeBuffers {
  /** Three floats per star on the sphere of `DOME_RADIUS`, equatorial of date. */
  positions: Float32Array;
  /** Linear RGB per star, dimmed by magnitude so the faint ones stay faint. */
  colours: Float32Array;
  /** Point size per star, in pixels at the dome's own distance. */
  sizes: Float32Array;
  count: number;
}

/** One of the stars the claims name, placed on the same sphere. */
export interface NamedDomeStar extends Equatorial {
  id: string;
  name: string;
  bayer: string;
  role: string | undefined;
  /** Position on the sphere of `DOME_RADIUS`, equatorial of date. */
  at: [number, number, number];
}

/**
 * Colour from the B-V colour index, over the range the catalogue actually
 * holds: about -0.3 for the hottest to 2.0 for the coolest. The ramp is a
 * plain interpolation between five anchors chosen to look like a photograph
 * of the sky rather than to be photometrically true, which nothing here
 * claims to be.
 */
const COLOUR_RAMP: ReadonlyArray<readonly [number, [number, number, number]]> = [
  [-0.3, [0.61, 0.71, 1.0]],
  [0.0, [0.79, 0.86, 1.0]],
  [0.4, [1.0, 0.99, 0.96]],
  [0.8, [1.0, 0.91, 0.75]],
  [1.6, [1.0, 0.76, 0.56]],
];

export function starColour(ci: number | undefined): [number, number, number] {
  if (ci === undefined) return [1, 0.97, 0.92];
  const first = COLOUR_RAMP[0] as (typeof COLOUR_RAMP)[number];
  const last = COLOUR_RAMP[COLOUR_RAMP.length - 1] as (typeof COLOUR_RAMP)[number];
  if (ci <= first[0]) return [...first[1]];
  if (ci >= last[0]) return [...last[1]];
  for (let i = 1; i < COLOUR_RAMP.length; i++) {
    const [hi, hiColour] = COLOUR_RAMP[i] as (typeof COLOUR_RAMP)[number];
    const [lo, loColour] = COLOUR_RAMP[i - 1] as (typeof COLOUR_RAMP)[number];
    if (ci > hi) continue;
    const t = (ci - lo) / (hi - lo);
    return [0, 1, 2].map((k) => (loColour[k] as number) + t * ((hiColour[k] as number) - (loColour[k] as number))) as [number, number, number];
  }
  return [...last[1]];
}

/** The magnitude at which a star is drawn at its smallest, which is the bundle's own cut. */
const FAINTEST = 6;

/** Point size in CSS pixels at the dome. A magnitude 6 star is one pixel; Sirius is about seven. */
export function starSize(mag: number): number {
  return Math.max(1, 1 + (FAINTEST - mag) * 0.85);
}

/** Brightness, as a multiplier on the colour. Faint stars are dim as well as small. */
export function starBrightness(mag: number): number {
  return Math.min(1, Math.max(0.3, 0.42 + (FAINTEST - mag) * 0.115));
}

/**
 * The whole catalogue precessed to one epoch and written into buffers. One
 * precession matrix serves every star, which is what makes dragging the epoch
 * slider affordable with five thousand of them.
 */
export function domeBuffers(catalogue: readonly BrightStar[], epoch: number, radius = DOME_RADIUS): DomeBuffers {
  const places = positionsAtEpoch(catalogue, epoch);
  const count = catalogue.length;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const { raDeg, decDeg } = places[i] as Equatorial;
    const v = sphericalToVec(raDeg, decDeg);
    positions[i * 3] = v[0] * radius;
    positions[i * 3 + 1] = v[1] * radius;
    positions[i * 3 + 2] = v[2] * radius;
    const star = catalogue[i] as BrightStar;
    const colour = starColour(star.ci);
    const lit = starBrightness(star.mag);
    colours[i * 3] = colour[0] * lit;
    colours[i * 3 + 1] = colour[1] * lit;
    colours[i * 3 + 2] = colour[2] * lit;
    sizes[i] = starSize(star.mag);
  }
  return { positions, colours, sizes, count };
}

/** The named stars on the same sphere, for the labels and the claim markers. */
export function namedOnDome(stars: readonly Star[], epoch: number, radius = DOME_RADIUS): NamedDomeStar[] {
  const places = positionsAtEpoch(stars, epoch);
  return stars.map((star, i) => {
    const at = places[i] as Equatorial;
    const v = sphericalToVec(at.raDeg, at.decDeg);
    return {
      id: star.id,
      name: star.name,
      bayer: star.bayer,
      role: star.role,
      raDeg: at.raDeg,
      decDeg: at.decDeg,
      at: [v[0] * radius, v[1] * radius, v[2] * radius],
    };
  });
}

/** A star of the bundle's named ones, by the display name a claim's overlay writes. */
export function starByName(stars: readonly Star[], name: string): Star | undefined {
  return stars.find((s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name.toLowerCase());
}
