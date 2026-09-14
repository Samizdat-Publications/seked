/**
 * The sky as a viewer draws it: where a star lands on a dome around the
 * observer, and the flat picture a claim makes of a group of stars.
 *
 * `horizon` turns one star's coordinates into an altitude and azimuth. This
 * module adds the two things a dome needs on top of that. The first is bulk:
 * a catalogue of several thousand stars shares one precession matrix, so it
 * is built once here rather than once per star. The second is the rotation
 * itself. Sidereal time does not move the stars relative to each other; it
 * turns the whole sphere about the celestial pole, so a viewer can precess a
 * catalogue once per epoch, keep the vectors, and hand the sidereal time to a
 * single rotation. `equatorialToHorizon` is that rotation, and it agrees with
 * `altAz` star for star, which a test pins.
 *
 * Angles are degrees; vectors are the project frame, +X east, +Y north,
 * +Z up.
 */
import { altAz, enuDirection } from './horizon';
import { positionAtEpoch, properMotionAtEpoch, type Equatorial, type StarMotion } from './stars';
import { apply, ltpb, sphericalToVec, vecToSpherical, type Mat3, type Vec3 } from './vondrak';

const D2R = Math.PI / 180;

/** Mean places of date for a whole catalogue, sharing one precession matrix. */
export function positionsAtEpoch(stars: readonly StarMotion[], epj: number): Equatorial[] {
  const m = ltpb(epj);
  return stars.map((star) => {
    const { raDeg, decDeg } = properMotionAtEpoch(star, epj);
    return vecToSpherical(apply(m, sphericalToVec(raDeg, decDeg)));
  });
}

/**
 * The rotation from equatorial coordinates of date to the project's
 * east-north-up, for an observer at `latDeg` whose local apparent sidereal
 * time is `lstDeg`. Apply it to `sphericalToVec(ra, dec)` and the result is
 * the unit vector `enuDirection(altAz(...))` gives, without the intermediate
 * angles.
 *
 * It is the hour-angle rotation about the pole followed by the tilt that puts
 * the pole at altitude `latDeg` due north, so its determinant is +1 and a
 * dome built from it can be a single point cloud that the sidereal-time
 * control simply turns.
 */
export function equatorialToHorizon(latDeg: number, lstDeg: number): Mat3 {
  const sinLat = Math.sin(latDeg * D2R);
  const cosLat = Math.cos(latDeg * D2R);
  const sinLst = Math.sin(lstDeg * D2R);
  const cosLst = Math.cos(lstDeg * D2R);
  // Rows are east, north and up; the columns are where the three equatorial
  // axes land, so the last one is the celestial pole, due north at altitude
  // `latDeg`.
  return [
    [-sinLst, cosLst, 0],
    [-sinLat * cosLst, -sinLat * sinLst, cosLat],
    [cosLat * cosLst, cosLat * sinLst, sinLat],
  ];
}

/** Where a star sits for an observer: its place of date, its horizon angles and its direction. */
export interface DomePlacement extends Equatorial {
  /** Geometric altitude above the horizon, degrees; negative below it. */
  altDeg: number;
  /** Azimuth from north through east, degrees. */
  azDeg: number;
  /** Unit vector in the project frame. */
  direction: Vec3;
}

export interface DomeObserver {
  /** Julian epoch in astronomical year numbering: 2450 BCE is -2449. */
  epoch: number;
  latitudeDeg: number;
  /** Local apparent sidereal time as an angle; see the note in `horizon`. */
  lstDeg: number;
}

/** One star, precessed to the epoch and placed on the observer's dome. */
export function placeOnDome(star: StarMotion, o: DomeObserver): DomePlacement {
  const { raDeg, decDeg } = positionAtEpoch(star, o.epoch);
  return placePosition({ raDeg, decDeg }, o.latitudeDeg, o.lstDeg);
}

/** As `placeOnDome`, for a position already precessed to the epoch. */
export function placePosition(at: Equatorial, latitudeDeg: number, lstDeg: number): DomePlacement {
  const { altDeg, azDeg } = altAz({ raDeg: at.raDeg, decDeg: at.decDeg, latDeg: latitudeDeg, lstDeg });
  return { ...at, altDeg, azDeg, direction: enuDirection(altDeg, azDeg) };
}

/** A point on the tangent plane about some centre star, in degrees. */
export interface TangentPoint {
  /** Difference in right ascension, times the cosine of the centre's declination. */
  x: number;
  /** Difference in declination. */
  y: number;
}

/** Fold a difference of angles into (-180, 180]. */
function wrap180(deg: number): number {
  const x = ((deg + 180) % 360 + 360) % 360;
  return x - 180;
}

/**
 * A star's offset from a centre star on the tangent plane about that centre:
 * x is the difference in right ascension times the cosine of the centre's
 * declination, y the difference in declination, both degrees. This is the
 * construction C4's formulas use, written once so the overlay's picture and
 * the claim's numbers cannot disagree. It is good to a few arcminutes over a
 * field of a few degrees, which is what Orion's Belt is.
 *
 * The right ascension difference is folded into (-180, 180], so a group that
 * straddles the equinox comes out as the small offsets it is rather than as
 * a difference of nearly 360.
 */
export function tangentOffset(star: Equatorial, centre: Equatorial): TangentPoint {
  return { x: wrap180(star.raDeg - centre.raDeg) * Math.cos(centre.decDeg * D2R), y: star.decDeg - centre.decDeg };
}

/**
 * The angle a line between two tangent-plane points makes with the meridian,
 * in degrees from 0 (along the meridian) to 90 (square to it). Unsigned, as
 * C4's comparison is: the claim is about shape, not handedness.
 */
export function meridianAngle(a: TangentPoint, b: TangentPoint): number {
  return Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / D2R;
}
