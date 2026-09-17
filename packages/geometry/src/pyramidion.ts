/**
 * The capstone at the top of a great pyramid, for the states that have one.
 *
 * Nothing about its form is a measurement. What the database carries is how
 * high on the apex the joint under the capstone is drawn, one record per
 * structure (`<id>.pyramidion.height`, a seked-estimate from the best
 * preserved royal pyramidion), and the pyramid's own face angle. The capstone
 * takes that angle, so its base follows from the two and cannot disagree with
 * the pyramid it sits on. If either record is missing, nothing is built.
 *
 * Unlike `pyramidMesh`, which builds a pyramid about its own base centre, this
 * comes back already standing in the site frame: at the structure's centre
 * offsets, on its base elevation, turned by its measured orientation. The
 * capstone is a detail on top of a pyramid a kilometre from the origin, so a
 * caller that had to place it would be placing it twice.
 *
 * Frame as everywhere else: origin at the Great Pyramid's base centre, +X
 * east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { pyramidMesh, type Mesh } from './mesh';

const DEG = Math.PI / 180;

/**
 * A mesh that says what it is.
 *
 * Every reconstruction in this package comes back with a sentence naming what
 * has been built and which of its dimensions are look choices rather than
 * records, so a viewer can put it on a hover label and a reader is never left
 * to guess which parts are survey. It extends `Mesh`, so anything that takes a
 * mesh takes one of these.
 */
export interface LabelledMesh extends Mesh {
  label: string;
}

/** The three surveyed pyramids, the only structures a pyramidion is built for. */
export type GreatPyramid = 'g1' | 'g2' | 'g3';

/**
 * Where a structure's base centre stands in the frame.
 *
 * Petrie triangulated G2 and G3 from G1 and the database stores those as
 * metres south and west, so west and south are negated; a structure placed by
 * a coordinate instead arrives as east and north through the environment's
 * derived offsets. G1 is the origin and falls out of this at zero either way.
 * The elevation defaults to the frame's datum plane, which is G1's own base,
 * the same default `blender/seked_data.py` and the basalt pavement use.
 */
export function structurePlacement(env: Environment, structure: string): { east: number; north: number; up: number; orientationDeg: number } {
  const east = env[`${structure}.centre.offset.east`] ?? -(env[`${structure}.centre.offset.west`] ?? 0);
  const north = env[`${structure}.centre.offset.north`] ?? -(env[`${structure}.centre.offset.south`] ?? 0);
  return {
    east,
    north,
    up: env[`${structure}.base.elevation.relative`] ?? 0,
    orientationDeg: env[`${structure}.orientation`] ?? 0,
  };
}

/**
 * The face angle of a structure: the measured one where the preset carries it,
 * else the one the environment derives from the base and the height, which is
 * what `profile.ts` computes. Nothing is assumed when neither is there.
 */
export function faceAngleDeg(env: Environment, structure: string): number | undefined {
  return env[`${structure}.face.angle`] ?? env[`${structure}.face.angle.derived`];
}

/** Every vertex turned about the vertical through the origin, then moved. */
export function placeMesh(mesh: Mesh, east: number, north: number, up: number, orientationDeg: number): Mesh {
  const cos = Math.cos(orientationDeg * DEG);
  const sin = Math.sin(orientationDeg * DEG);
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i] as number;
    const y = mesh.positions[i + 1] as number;
    positions[i] = x * cos - y * sin + east;
    positions[i + 1] = x * sin + y * cos + north;
    positions[i + 2] = (mesh.positions[i + 2] as number) + up;
  }
  return { positions, indices: mesh.indices, vertexCount: mesh.vertexCount, triangleCount: mesh.triangleCount };
}

/** The capstone's numbers in double precision, before a float32 mesh is made of them. */
export interface PyramidionProfile {
  height: number;
  baseSide: number;
  faceAngleDeg: number;
  /** Where the apex stands in the frame, which is the structure's own apex. */
  apex: [number, number, number];
  /** True when the angle came from a record rather than from the base and the height. */
  angleMeasured: boolean;
}

/**
 * Everything the capstone is, as numbers.
 *
 * The mesh stores its positions as float32, which at 146 m up is good to about
 * ten micrometres and so cannot carry an angle to more than about a
 * thousandth of a degree. Anything that wants the angle itself, or wants to
 * check it against the pyramid's, asks here instead.
 */
export function pyramidionProfile(env: Environment, structure: GreatPyramid): PyramidionProfile | undefined {
  const height = env[`${structure}.pyramidion.height`];
  const apexHeight = env[`${structure}.height.original`];
  const angle = faceAngleDeg(env, structure);
  if (height === undefined || apexHeight === undefined || angle === undefined) return undefined;
  if (!(height > 0) || !(angle > 0) || !(angle < 90) || !(apexHeight > height)) return undefined;
  const place = structurePlacement(env, structure);
  return {
    height,
    baseSide: (2 * height) / Math.tan(angle * DEG),
    faceAngleDeg: angle,
    apex: [place.east, place.north, place.up + apexHeight],
    angleMeasured: env[`${structure}.face.angle`] !== undefined,
  };
}

/**
 * The capstone of one great pyramid, its apex at the pyramid's apex.
 *
 * Its height is `<id>.pyramidion.height` and its faces stand at the
 * structure's own angle, so its base side is twice the height over the tangent
 * of that angle. It is drawn without the concavity: the hollowing is a
 * property of the casing faces, 0.94 m across a 230 m base, and at the size of
 * a capstone it is far below anything that could be seen.
 */
export function pyramidionMesh(env: Environment, structure: GreatPyramid): LabelledMesh | undefined {
  const profile = pyramidionProfile(env, structure);
  if (profile === undefined) return undefined;
  const { height, baseSide, faceAngleDeg: angle, apex } = profile;

  const place = structurePlacement(env, structure);
  const mesh = placeMesh(
    pyramidMesh({ base: baseSide, height }),
    place.east,
    place.north,
    (apex[2] as number) - height,
    place.orientationDeg,
  );
  const measured = profile.angleMeasured ? 'measured' : 'derived from the base and the height';
  return {
    ...mesh,
    label:
      `Reconstruction: the capstone of ${structure.toUpperCase()}, ${height.toFixed(2)} m high from ` +
      `${structure}.pyramidion.height, at the pyramid's own face angle of ${angle.toFixed(4)} degrees ` +
      `(${measured}), so its base of ${baseSide.toFixed(2)} m is computed and not chosen. No pyramidion ` +
      'of Khufu, Khafre or Menkaure survives. Look choices: four plain faces, no concavity, no separate ' +
      'bedding course, and the material is the renderer’s.',
  };
}
