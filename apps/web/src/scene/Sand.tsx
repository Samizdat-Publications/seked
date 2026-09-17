/**
 * The sand that buried the Sphinx to the neck.
 *
 * In `stripped` the enclosure is full. That is the documented condition of the
 * monument from antiquity until Baraize cleared it between 1925 and 1936: the
 * early travellers drew a head and a shoulder standing out of a dune, and
 * Caviglia and Mariette each dug it out and each saw it fill again. Only the
 * state is documented; the level here is not, and nothing in this file is a
 * measurement.
 *
 * The surface is drawn as a flat fill inside the trench's own plan with a bank
 * running out from it to meet the plateau, so it neither floats over the
 * ground that has fallen away to the east nor cuts through the higher ground
 * behind the Sphinx's back. Both the level and the bank are look choices and
 * are named as such below; the level follows the data at least, being a
 * fraction of the head's own OSM height above the trench floor, so a better
 * footprint moves it.
 *
 * Frame as everywhere else inside the one rotated group: +X east, +Y north,
 * +Z up, metres.
 */
import { capMesh, type Mesh as SekedMesh } from '@seked/geometry';
import { useEffect, useMemo } from 'react';
import type { Plane } from 'three';
import { useView } from '../store';
import { meshGeometry } from './geometry';
import { StoneSurface, groundSampler, useSphinxCut, type SekedTag } from './Trench';
import type { TerrainProps } from './Terrain';

/**
 * LOOK CHOICES, not measurements.
 *
 * `headFraction` is how far up the Sphinx's own head the sand stands, as a
 * fraction of the head footprint's OSM height above the trench floor: at 0.7
 * the body and the lower head are under it and the face and the neck are
 * clear, which is what the early travellers drew. `bankMetres` is how far the
 * sand spreads beyond the cut before it reaches the plateau, which is what
 * keeps its edge from being a wall. A record would replace neither: what is
 * documented is that the enclosure was full, not to what level on which day.
 */
const LOOK = { headFraction: 0.7, bankMetres: 30 };

type Xy = readonly [number, number];

/** The same ring at two levels, as a band facing out and up: the sand's bank. */
function bankMesh(inner: readonly Xy[], innerZ: number, outer: readonly Xy[], outerZ: readonly number[]): SekedMesh {
  const n = inner.length;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const [x, y] = inner[i] as Xy;
    positions.set([x, y, innerZ], i * 3);
    const [ox, oy] = outer[i] as Xy;
    positions.set([ox, oy, outerZ[i] as number], (n + i) * 3);
  }
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.set([i, n + i, j, j, n + i, n + j], i * 6);
  }
  return { positions, indices, vertexCount: n * 2, triangleCount: n * 2 };
}

/** The ring pushed straight out from its own centroid, which is enough for a bank. */
function spread(ring: readonly Xy[], metres: number): Xy[] {
  const cx = ring.reduce((a, [x]) => a + x, 0) / ring.length;
  const cy = ring.reduce((a, [, y]) => a + y, 0) / ring.length;
  return ring.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy);
    return d === 0 ? ([x, y] as Xy) : ([x + ((x - cx) / d) * metres, y + ((y - cy) / d) * metres] as Xy);
  });
}

export interface SandProps {
  terrain: TerrainProps;
  clippingPlanes: Plane[];
}

export function Sand({ terrain, clippingPlanes }: SandProps): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const cut = useSphinxCut();
  const ground = useMemo(() => groundSampler(terrain), [terrain]);

  const filled = useMemo(() => {
    if (state !== 'stripped' || !cut || cut.headHeight === undefined) return undefined;
    const level = cut.floor + LOOK.headFraction * cut.headHeight;
    const outer = spread(cut.outline, LOOK.bankMetres);
    // The bank runs down to the plateau, or up to the sand where the plateau
    // is the higher of the two, which is the ground behind the Sphinx's back.
    const outerZ = outer.map(([x, y]) => Math.min(level, ground(x, y)));
    return { level, cap: capMesh(cut.outline, level), bank: bankMesh(cut.outline, level, outer, outerZ) };
  }, [state, cut, ground]);

  const capGeometry = useMemo(() => (filled ? meshGeometry(filled.cap) : undefined), [filled]);
  const bankGeometry = useMemo(() => (filled ? meshGeometry(filled.bank) : undefined), [filled]);
  useEffect(() => () => {
    capGeometry?.dispose();
    bankGeometry?.dispose();
  }, [capGeometry, bankGeometry]);

  if (!filled || !capGeometry || !bankGeometry) return null;
  const seked: SekedTag = {
    name: 'The sand in the Sphinx enclosure',
    tier: 'reconstruction',
    note:
      'Reconstruction: the enclosure full, which is the documented condition until Baraize cleared it between 1925 and 1936. ' +
      `Look choices: its level is ${LOOK.headFraction} of the head footprint's own height above the trench floor, ` +
      `which is ${filled.level.toFixed(2)} m here, and it banks out ${LOOK.bankMetres} m to meet the plateau. Neither is a measurement.`,
    state,
  };
  const stone = { role: 'sand' as const, options: { strength: 0.85, scale: 2, relief: 0.35 }, colour: '#b6a281', roughness: 1 };
  return (
    <>
      <StoneSurface geometry={capGeometry} name="sphinx.enclosure.sand" seked={seked} clippingPlanes={clippingPlanes} both {...stone} />
      <StoneSurface geometry={bankGeometry} name="sphinx.enclosure.sand.bank" seked={seked} clippingPlanes={clippingPlanes} both {...stone} />
    </>
  );
}
