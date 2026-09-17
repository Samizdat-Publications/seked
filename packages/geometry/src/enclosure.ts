/**
 * The enclosure wall round a great pyramid, and the roof over Khafre's
 * causeway.
 *
 * Both are things every reconstruction of Giza draws and this database does
 * not yet hold. Each pyramid stood inside a walled court, and the causeways
 * were walled and roofed passages lit by slits in the roof, but no distance
 * from a base edge to an enclosure wall and no height for one has been
 * entered here. So `enclosureWallMesh` looks for those records, in the
 * structure's own name first and in the plateau-wide `tier3` name second, and
 * builds nothing at all when neither is there. It does not fall back on a
 * plausible figure: a wall at a guessed distance would look exactly like a
 * wall at a surveyed one.
 *
 * The causeway roof is different, because both numbers it needs are in the
 * database already: `khafre.causeway.thickness` for the slab and
 * `tier3.causeway.corridor.height` for how high over the causeway's own top
 * it is carried. It is laid on the same ribbon of segments the footprint
 * import built from the terrain, so it climbs with the ridge the causeway
 * climbs.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { footprintMesh, type Footprint } from './footprints';
import type { Mesh } from './mesh';
import { placeMesh, structurePlacement, type LabelledMesh } from './pyramidion';
import { annulusMesh } from './temple';

/**
 * How thick an enclosure wall is drawn where the database names no thickness,
 * metres. A look choice, and the only number here that is one: the wall is not
 * built at all unless the database says how far out it stands and how high.
 */
export const ENCLOSURE_THICKNESS = 3;

/** The first of these keys the environment carries, or nothing. */
function firstOf(env: Environment, keys: readonly string[]): { key: string; value: number } | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && Number.isFinite(value)) return { key, value };
  }
  return undefined;
}

/** A square ring of this half width, counter-clockwise seen from above. */
function square(half: number): [number, number][] {
  return [[half, half], [-half, half], [-half, -half], [half, -half]];
}

/**
 * The wall round one pyramid's court: a square ring standing off the base
 * edge by the recorded distance, on the structure's own centre, elevation and
 * orientation. Undefined unless the database carries both the distance and the
 * height, under the structure's own key or the plateau-wide one.
 *
 * A distance is to the wall's near face unless the key it came from ends in
 * `.outer`, in which case it is to the far one and the wall's own thickness is
 * taken off it. Petrie measured the peribolus of the Second Pyramid to its
 * outer face, and a record should carry the number he wrote rather than one
 * moved to suit this function.
 */
export function enclosureWallMesh(env: Environment, structure: string): LabelledMesh | undefined {
  const side = env[`${structure}.base.side.mean`];
  const distance = firstOf(env, [
    `${structure}.enclosure.distance`,
    'tier3.enclosure.distance',
    `${structure}.enclosure.distance.outer`,
    'tier3.enclosure.distance.outer',
  ]);
  const height = firstOf(env, [`${structure}.enclosure.height`, 'tier3.enclosure.height']);
  if (side === undefined || !(side > 0) || distance === undefined || height === undefined) return undefined;
  if (!(distance.value > 0) || !(height.value > 0)) return undefined;
  const thickness = firstOf(env, [`${structure}.enclosure.thickness`, 'tier3.enclosure.thickness']);
  const wall = thickness?.value ?? ENCLOSURE_THICKNESS;
  if (!(wall > 0)) return undefined;

  const toOuter = distance.key.endsWith('.outer');
  const inner = side / 2 + distance.value - (toOuter ? wall : 0);
  if (!(inner > side / 2)) return undefined;
  const mesh = annulusMesh(square(inner + wall), square(inner), 0, height.value);
  if (mesh === undefined) return undefined;
  const place = structurePlacement(env, structure);
  return {
    ...placeMesh(mesh, place.east, place.north, place.up, place.orientationDeg),
    label:
      `Reconstruction: the enclosure wall of ${structure.toUpperCase()}, ${distance.value} m off the base ` +
      `edge to its ${toOuter ? 'outer' : 'inner'} face from ${distance.key} and ${height.value} m high from ` +
      `${height.key}, on the structure's own centre, base elevation and orientation. Look choices: a square ` +
      `ring, and a thickness of ${wall} m` +
      `${thickness === undefined ? ', the database naming none' : ` from ${thickness.key}`}.`,
  };
}

/**
 * The roof over Khafre's causeway: the causeway's own ribbon lifted clear of
 * it by `tier3.causeway.corridor.height` and drawn as a slab
 * `khafre.causeway.thickness` deep, so it follows the ridge the causeway
 * follows rather than running level over it.
 */
export function causewayRoofMesh(env: Environment, features: readonly Footprint[], id = 'khafre.causeway'): LabelledMesh | undefined {
  const causeway = features.find((f) => f.id === id);
  const thickness = env['khafre.causeway.thickness'];
  const corridor = env['tier3.causeway.corridor.height'];
  if (causeway === undefined || thickness === undefined || corridor === undefined) return undefined;
  if (!(thickness > 0) || !(corridor > 0)) return undefined;

  const lift = thickness + corridor;
  const roof: Footprint = {
    ...causeway,
    id: `${causeway.id}.roof`,
    base: causeway.base + lift,
    height: thickness,
    heightKey: undefined,
    ...(causeway.bases === undefined ? {} : { bases: causeway.bases.map((b) => b + lift) }),
  };
  const mesh = footprintMesh(roof, env);
  if (mesh === undefined) return undefined;
  return {
    ...mesh,
    label:
      `Reconstruction: the roof over ${causeway.name}, carried ${corridor} m over the causeway's own top ` +
      'from tier3.causeway.corridor.height and drawn as a slab of khafre.causeway.thickness, the ' +
      'causeway’s own. Look choices: reusing that thickness for the slab, and a flat roof with no ' +
      'lighting slits. The walls under it are not built: no record here gives them.',
  };
}
