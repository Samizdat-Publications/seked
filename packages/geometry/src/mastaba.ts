/**
 * The mastaba fields, cased and ruined.
 *
 * The 577 tombs OSM traces on the plateau arrive as outlines with no height
 * of their own: `tier3.mastaba.height` is one massing figure for all of them
 * and `tier3.mastaba.batter` is Reisner's mean for the core mastabas of the
 * Western Field. `footprintMesh` already builds the battered core those two
 * give, and this does not build a second one; it takes that core and adds the
 * two things the early states need, then cuts it down for the late ones.
 *
 *   cased   the battered core, a smooth casing skin set 0.05 m inside the
 *           base outline and carried straight up, and an offering chapel on
 *           the east face, which is the side a mastaba's chapel is on
 *   ruined  the same core cut off somewhere between three and seven tenths of
 *           its height, so a field of them does not read as one tidy height
 *
 * The ruin's fraction is drawn from the footprint's own id, so the same tomb
 * is the same ruin in every render, in Blender and in the viewer, without a
 * number per tomb being stored anywhere.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { footprintMesh, footprintSpan, insetRing, ringCentroid, type Footprint } from './footprints';
import type { Mesh } from './mesh';
import type { LabelledMesh } from './pyramidion';

/**
 * How far inside the base outline the casing skin stands, metres. A look
 * choice: no casing thickness for a mastaba is in the database, and this is
 * only enough for the two faces to be told apart and given their own material.
 */
export const CASING_INSET = 0.05;

/**
 * The offering chapel on the east face: along the face, into it, and up,
 * metres. A look choice through and through. Mastaba chapels at Giza run from
 * a niche in the casing to a suite of rooms, and no record here says which any
 * one of these 577 tombs had, so one small block stands for all of them.
 */
export const CHAPEL_SIZE = { along: 3, into: 2, up: 2.5 };

/** The least and the most of its height a ruined mastaba is left standing at. */
export const RUIN_RANGE = { low: 0.3, high: 0.7 };

/**
 * Every mesh in one, the later ones' indices moved along.
 *
 * `tones`, where it is given, is one number per mesh, and it comes back as
 * one number per vertex: whatever the caller passed for a mesh, written to
 * every vertex that mesh contributed. That is the only way a shader can tell
 * one of the merged bodies from another once they are a single buffer, and
 * the reason the mastaba field wants it is in docs/shot-list.md: the field is
 * in all eleven shots of the walkthrough and it is 577 tombs sharing one
 * tone, so it reads as a pale carpet rather than a cemetery.
 *
 * A cell of world space would be the cheap way to vary them and it is the
 * wrong one: a tomb is about the size of such a cell, so the boundary would
 * fall across tombs and cut them in half. The number has to belong to the
 * body, which means it has to be written here, where the bodies are still
 * separate.
 */
export function mergeMeshes(meshes: readonly Mesh[], tones?: readonly number[]): Mesh {
  let vertexCount = 0;
  let triangleCount = 0;
  for (const m of meshes) {
    vertexCount += m.vertexCount;
    triangleCount += m.triangleCount;
  }
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(triangleCount * 3);
  const perVertex = tones ? new Float32Array(vertexCount) : undefined;
  let vertex = 0;
  let index = 0;
  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m] as Mesh;
    positions.set(mesh.positions, vertex * 3);
    for (let i = 0; i < mesh.indices.length; i++) indices[index + i] = (mesh.indices[i] as number) + vertex;
    if (perVertex) perVertex.fill(tones?.[m] ?? 0, vertex, vertex + mesh.vertexCount);
    vertex += mesh.vertexCount;
    index += mesh.indices.length;
  }
  return { positions, indices, vertexCount, triangleCount, ...(perVertex ? { tones: perVertex } : {}) };
}

/**
 * A number in [0, 1) from a string, by FNV-1a with a final avalanche. The
 * point is only that it is the same number everywhere the same id is read, so
 * a ruin does not move between one render and the next; nothing is claimed
 * about the number.
 *
 * The avalanche is not decoration, and it was added on 2026-09-19 after the
 * mastaba field would not vary. FNV-1a ends on a multiply, so two ids that
 * differ only in their last character come out differing by one multiple of
 * the prime: 16777619 over 2^32, which is 0.0039. Every id here is an OSM way
 * id and OSM issues them in sequence, so neighbouring tombs were getting
 * fractions four thousandths apart. A field of 577 of them spanned a few per
 * cent of the range instead of all of it, which is why they all stood at the
 * same ruined height and, once a tone per tomb was fed from the same hash,
 * why they were all the same colour.
 *
 * The finaliser is the xor-shift-multiply of MurmurHash3, which is the
 * standard fix: it spreads a one-bit change across the whole word, so
 * consecutive ids give unrelated fractions.
 */
export function hashFraction(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // MurmurHash3's fmix32.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

/** How much of its height this tomb is left standing at, from its id alone. */
export function ruinFraction(id: string): number {
  return RUIN_RANGE.low + (RUIN_RANGE.high - RUIN_RANGE.low) * hashFraction(id);
}

function rectangle(id: string, base: number, height: number, ring: [number, number][]): Footprint {
  return { id, name: id, kind: 'prism', group: 'mastabas', base, height, area: 0, ring };
}

/**
 * The offering chapel, a block centred on the easternmost point of the
 * outline at the outline's own northing, half in and half out of the face.
 */
export function mastabaChapelMesh(f: Footprint, env: Environment): Mesh | undefined {
  const span = footprintSpan(f, env);
  if (span === undefined) return undefined;
  const east = Math.max(...f.ring.map(([x]) => x));
  const north = ringCentroid(f.ring)[1];
  const x0 = east - CHAPEL_SIZE.into / 2;
  const x1 = east + CHAPEL_SIZE.into / 2;
  const y0 = north - CHAPEL_SIZE.along / 2;
  const y1 = north + CHAPEL_SIZE.along / 2;
  // Counter-clockwise seen from above, as every ring here is.
  const ring: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return footprintMesh(rectangle(`${f.id}.chapel`, span.bottom, CHAPEL_SIZE.up, ring), env);
}

/**
 * One mastaba, cased or ruined. Nothing is built for a footprint outside the
 * mastaba fields, or for one the environment cannot give a height.
 */
export function mastabaMesh(f: Footprint, env: Environment, state: 'cased' | 'ruined'): LabelledMesh | undefined {
  if (f.group !== 'mastabas') return undefined;
  const span = footprintSpan(f, env);
  if (span === undefined) return undefined;
  const height = span.top - span.bottom;

  if (state === 'ruined') {
    const fraction = ruinFraction(f.id);
    const mesh = footprintMesh({ ...f, height: fraction * height }, env);
    if (mesh === undefined) return undefined;
    return {
      ...mesh,
      label:
        `Reconstruction: ${f.name} as a ruin, the battered core of tier3.mastaba.height and ` +
        `tier3.mastaba.batter cut off at ${(fraction * 100).toFixed(0)} percent of its height. Look ` +
        `choices: the ${RUIN_RANGE.low} to ${RUIN_RANGE.high} range, and the fraction within it, which is ` +
        'drawn from the footprint id so this tomb is the same ruin in every render.',
    };
  }

  const core = footprintMesh(f, env);
  const skin = footprintMesh({ ...f, ring: insetRing(f.ring, CASING_INSET) as [number, number][], batterKey: undefined }, env);
  const chapel = mastabaChapelMesh(f, env);
  if (core === undefined || skin === undefined || chapel === undefined) return undefined;
  return {
    ...mergeMeshes([core, skin, chapel]),
    label:
      `Reconstruction: ${f.name} cased, over the battered core of tier3.mastaba.height and ` +
      `tier3.mastaba.batter. Look choices: a smooth casing skin ${CASING_INSET} m inside the base outline ` +
      `and carried straight up over the batter, and an offering chapel ${CHAPEL_SIZE.along} by ` +
      `${CHAPEL_SIZE.into} by ${CHAPEL_SIZE.up} m centred on the east face. Neither the casing's thickness ` +
      'nor the chapel is a measurement of this tomb or of any other.',
  };
}
