/**
 * Units used across the project. The database stores metres and degrees;
 * everything here converts to and from the display and claim units.
 */

export const DEG = Math.PI / 180;

/** Conventional royal cubit for display. The measured cubit lives in the database as `cubit.royal`. */
export const ROYAL_CUBIT_M = 0.5236;
export const BRITISH_INCH_M = 0.0254;
/** Piazzi Smyth's pyramid inch: 1.001 British inches. */
export const PYRAMID_INCH_M = 1.001 * BRITISH_INCH_M;

export function metresToCubits(m: number, cubit = ROYAL_CUBIT_M): number {
  return m / cubit;
}
export function cubitsToMetres(rc: number, cubit = ROYAL_CUBIT_M): number {
  return rc * cubit;
}
export function inchesToMetres(inches: number): number {
  return inches * BRITISH_INCH_M;
}
export function metresToInches(m: number): number {
  return m / BRITISH_INCH_M;
}
export function metresToPyramidInches(m: number): number {
  return m / PYRAMID_INCH_M;
}

/**
 * Seked: horizontal run in palms for one cubit (seven palms) of rise.
 * A seked of 5½ gives the Great Pyramid's slope; 5¼ gives Khafre's 3-4-5.
 */
export function sekedToDegrees(seked: number): number {
  return Math.atan2(7, seked) / DEG;
}
export function degreesToSeked(deg: number): number {
  return 7 / Math.tan(deg * DEG);
}

export function dmsToDegrees(d: number, m = 0, s = 0): number {
  const negative = d < 0 || Object.is(d, -0);
  const magnitude = Math.abs(d) + m / 60 + s / 3600;
  return negative ? -magnitude : magnitude;
}

export interface Dms {
  sign: 1 | -1;
  d: number;
  m: number;
  s: number;
}

export function degreesToDms(deg: number, secondsDigits = 0): Dms {
  const sign: 1 | -1 = deg < 0 ? -1 : 1;
  const f = 10 ** secondsDigits;
  const total = Math.round(Math.abs(deg) * 3600 * f) / f;
  const d = Math.floor(total / 3600);
  const m = Math.floor((total - d * 3600) / 60);
  const s = Number((total - d * 3600 - m * 60).toFixed(secondsDigits));
  return { sign, d, m, s };
}

/** 51.8444 → "51°50′40″". Uses a true minus sign for negatives. */
export function formatDms(deg: number, secondsDigits = 0): string {
  const { sign, d, m, s } = degreesToDms(deg, secondsDigits);
  const sStr = secondsDigits > 0 ? s.toFixed(secondsDigits) : String(Math.round(s));
  const sWidth = secondsDigits > 0 ? 3 + secondsDigits : 2;
  return `${sign < 0 ? '−' : ''}${d}°${String(m).padStart(2, '0')}′${sStr.padStart(sWidth, '0')}″`;
}

/** Small angles: −0.0583 → "−3.5′". */
export function formatArcminutes(deg: number, digits = 1): string {
  const v = deg * 60;
  return `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}′`;
}

export function formatArcseconds(deg: number, digits = 1): string {
  const v = deg * 3600;
  return `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}″`;
}
