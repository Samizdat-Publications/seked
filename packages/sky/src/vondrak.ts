/**
 * Long-term precession: Vondrák, Capitaine & Wallace (2011), A&A 534, A22,
 * valid for ±200,000 years around J2000. The IAU 2006 polynomials most
 * libraries ship are wrong by degrees at 10,500 BCE; this model is what
 * Stellarium uses and what the Orion and Leo claims need.
 *
 * Coefficient tables and the vector construction follow the paper as
 * implemented in ERFA (BSD-3, github.com/liberfa/erfa: ltpecl, ltpequ, ltp,
 * ltpb). The tests reproduce ERFA's reference values to 1e-13.
 *
 * Conventions: epochs are Julian epochs (2000.0 = J2000; 10,500 BCE is
 * −10499.0 in astronomical year numbering). Vectors are unit vectors in the
 * J2000 mean equatorial frame unless stated otherwise.
 */
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

const DAS2R = Math.PI / (180 * 3600);
const D2PI = 2 * Math.PI;

/** Obliquity at J2000 (IAU 2006), arcseconds. */
const EPS0 = 84381.406 * DAS2R;

// Precession of the ecliptic: polynomial and periodic terms for P_A, Q_A (arcsec).
const PQPOL: [number[], number[]] = [
  [5851.607687, -0.1189, -0.00028913, 0.000000101],
  [-1600.8863, 1.1689818, -0.0000002, -0.000000437],
];
// period (centuries), P cos, Q cos, P sin, Q sin
const PQPER: number[][] = [
  [708.15, -5486.751211, -684.66156, 667.66673, -5523.863691],
  [2309.0, -17.127623, 2446.28388, -2354.886252, -549.74745],
  [1620.0, -617.517403, 399.671049, -428.152441, -310.998056],
  [492.2, 413.44294, -356.652376, 376.202861, 421.535876],
  [1183.0, 78.614193, -186.387003, 184.778874, -36.776172],
  [622.0, -180.732815, -316.80007, 335.321713, -145.278396],
  [882.0, -87.676083, 198.296701, -185.138669, -34.74445],
  [547.0, 46.140315, 101.135679, -120.97283, 22.885731],
];

// Precession of the equator: polynomial and periodic terms for X_A, Y_A (arcsec).
const XYPOL: [number[], number[]] = [
  [5453.282155, 0.4252841, -0.00037173, -0.000000152],
  [-73750.93035, -0.7675452, -0.00018725, 0.000000231],
];
// period (centuries), X cos, Y cos, X sin, Y sin
const XYPER: number[][] = [
  [256.75, -819.940624, 75004.344875, 81491.287984, 1558.515853],
  [708.15, -8444.676815, 624.033993, 787.163481, 7774.939698],
  [274.2, 2600.009459, 1251.136893, 1251.296102, -2219.534038],
  [241.45, 2755.17563, -1102.212834, -1257.950837, -2523.969396],
  [2309.0, -167.659835, -2660.66498, -2966.79973, 247.850422],
  [492.2, 871.855056, 699.291817, 639.744522, -846.485643],
  [396.1, 44.769698, 153.16722, 131.600209, -1393.124055],
  [288.9, -512.313065, -950.865637, -445.040117, 368.526116],
  [231.1, -819.415595, 499.754645, 584.522874, 749.045012],
  [1610.0, -538.071099, -145.18821, -89.756563, 444.704518],
  [620.0, -189.793622, 558.116553, 524.42963, 235.934465],
  [157.87, -402.922932, -23.923029, -13.549067, 374.049623],
  [220.3, 179.516345, -165.405086, -210.157124, -171.33018],
  [1200.0, -9.814756, 9.344131, -44.919798, -22.899655],
];

function series(t: number, pol: [number[], number[]], per: number[][]): [number, number] {
  let a = 0, b = 0;
  const w = D2PI * t;
  for (const row of per) {
    const arg = w / (row[0] as number);
    const s = Math.sin(arg), c = Math.cos(arg);
    a += c * (row[1] as number) + s * (row[3] as number);
    b += c * (row[2] as number) + s * (row[4] as number);
  }
  let tp = 1;
  for (let i = 0; i < 4; i++) {
    a += (pol[0][i] as number) * tp;
    b += (pol[1][i] as number) * tp;
    tp *= t;
  }
  return [a * DAS2R, b * DAS2R];
}

/** Unit vector of the ecliptic pole at Julian epoch `epj`, J2000 mean equatorial frame. */
export function ltpecl(epj: number): Vec3 {
  const t = (epj - 2000) / 100;
  const [p, q] = series(t, PQPOL, PQPER);
  let w = 1 - p * p - q * q;
  w = w < 0 ? 0 : Math.sqrt(w);
  const s = Math.sin(EPS0), c = Math.cos(EPS0);
  return [p, -q * c - w * s, -q * s + w * c];
}

/** Unit vector of the equator pole (mean of date) at Julian epoch `epj`, J2000 mean equatorial frame. */
export function ltpequ(epj: number): Vec3 {
  const t = (epj - 2000) / 100;
  const [x, y] = series(t, XYPOL, XYPER);
  const w = 1 - x * x - y * y;
  return [x, y, w < 0 ? 0 : Math.sqrt(w)];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m === 0 ? [0, 0, 0] : [v[0] / m, v[1] / m, v[2] / m];
}
export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Precession matrix from J2000 mean equator and equinox to the mean equator and equinox of `epj`. */
export function ltp(epj: number): Mat3 {
  const peqr = ltpequ(epj);
  const pecl = ltpecl(epj);
  const eqx = normalize(cross(peqr, pecl));
  const v = cross(peqr, eqx);
  return [eqx, v, peqr];
}

/** As `ltp`, but from the ICRS (GCRS) by including the IAU 2006 frame bias. Use this for catalogue positions. */
export function ltpb(epj: number): Mat3 {
  const dx = -0.016617 * DAS2R, de = -0.0068192 * DAS2R, dr = -0.0146 * DAS2R;
  const rp = ltp(epj);
  return rp.map((r) => [
    r[0] - r[1] * dr + r[2] * dx,
    r[0] * dr + r[1] + r[2] * de,
    -r[0] * dx - r[1] * de + r[2],
  ]) as Mat3;
}

export function sphericalToVec(raDeg: number, decDeg: number): Vec3 {
  const ra = (raDeg * Math.PI) / 180, dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}
export function vecToSpherical(v: Vec3): { raDeg: number; decDeg: number } {
  const ra = Math.atan2(v[1], v[0]);
  return { raDeg: ((ra * 180) / Math.PI + 360) % 360, decDeg: (Math.asin(v[2]) * 180) / Math.PI };
}

/** ICRS right ascension and declination → mean equator and equinox of date. */
export function precessIcrsToDate(raDeg: number, decDeg: number, epj: number): { raDeg: number; decDeg: number } {
  return vecToSpherical(apply(ltpb(epj), sphericalToVec(raDeg, decDeg)));
}
