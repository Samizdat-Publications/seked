/**
 * Meridian geometry for an observer at latitude φ (degrees, north positive).
 * Transit altitudes need no sidereal time, which is why the shaft claims can
 * be computed before the sun and horizon machinery exist.
 */

/** Altitude at upper culmination; the star is south of the zenith when dec < lat, north when dec > lat. */
export function transitAltitude(decDeg: number, latDeg: number): number {
  return 90 - Math.abs(latDeg - decDeg);
}

/** True when the upper culmination is on the north side of the zenith. */
export function transitIsNorth(decDeg: number, latDeg: number): boolean {
  return decDeg > latDeg;
}

/** Altitude at lower culmination (below the pole); negative means it sets. */
export function lowerCulminationAltitude(decDeg: number, latDeg: number): number {
  return decDeg + latDeg - 90;
}

/** Circumpolar from this latitude (never sets). */
export function isCircumpolar(decDeg: number, latDeg: number): boolean {
  return lowerCulminationAltitude(decDeg, latDeg) > 0;
}
