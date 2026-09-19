/**
 * Giza and Cairo behind the plateau, in `today` and nowhere else.
 *
 * This is what makes the last stop of the timeline read as the last stop. The
 * three pyramids on an empty desert are the postcard; the pyramids at the
 * edge of a city that came up to meet them are the photograph, and the change
 * between the First Time and now is most of what this viewer is for.
 *
 * THE CITY IS CONTEXT AND NOT EVIDENCE. Nothing drawn here carries an
 * evidence tier, no claim may cite it, and the hover tag says the word.
 * `data/footprints/city.json` is the contract: 231,988 buildings whose
 * outlines are Google's Open Buildings v3 and whose heights are the Open
 * Buildings 2.5D Temporal raster of 2023, with a stated mean absolute error
 * of 1.5 m, reduced to the best-fit box of each outline. The box is not the
 * building's shape and the file says so.
 *
 * The two files are fetched rather than bundled, because six and a half
 * megabytes of boxes has no business in `seked.json`, and they are fetched
 * only once the timeline is at `today`: a reader who never leaves the First
 * Time never downloads a city.
 *
 * Nothing here fades itself. Every mesh carries the `userData.seked` tag and
 * `fade.ts` dissolves it with the rest of the stop, which is the same
 * arrangement every other state-dependent component in the scene uses.
 *
 * Frame as everywhere else inside the one rotated group: +X east, +Y north,
 * +Z up, metres.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MeshStandardMaterial, Vector3, type BufferGeometry, type Plane } from 'three';
import {
  CITY_STRIDE,
  cityBatchMesh,
  cityBatches,
  type CityBatch,
  type CityLevel,
} from '@seked/geometry';
import { useView } from '../store';
import { applyAtmosphere } from './Atmosphere';
import { gridGeometry } from './geometry';
import { chooseLod, newLod, type Lod } from './lod';
import { applyStone, useStone } from './materials/stone';
import { groundSampler } from './Trench';
import type { DesertProps, TerrainProps } from './Terrain';

/**
 * LOOK CHOICES, not measurements. What is measured about the city is where
 * each building is, how big it is, which way it faces and how tall it is;
 * everything below is how those boxes are drawn.
 *
 * `coarseMetres` is how far from the camera a batch stops drawing its small
 * buildings. Two and a half kilometres is about where a fifteen-metre shed is
 * a few pixels across at this field of view, which is not a building, while a
 * block of flats still has a silhouette worth having.
 *
 * `colour` is the flat tint under the photographed stone: the pale grey-brown
 * of unrendered brick and concrete that Giza is mostly built of, which is
 * close enough to the sand that the two read as one place. `roughness` is
 * flat, because a city of a quarter of a million roofs has no gloss anyone
 * can see from the plateau.
 */
const LOOK = {
  coarseMetres: 2500,
  colour: '#b0a291',
  roughness: 1,
  /** Metres of the sand set's own tile, multiplied, so a wall does not read as a beach. */
  stoneScale: 4,
  stoneStrength: 0.45,
  stoneRelief: 0.25,
} as const;

/** The header of `city.json`, in the part this file reads. */
interface CityHeader {
  context: boolean;
  attribution: string;
  heights: { imageryYear: number; meanAbsoluteErrorM: number; measured: number; unmeasured: number };
  outlines: { kept: number };
  binary: { count: number; stride: number; record: string[] };
  cells: { size: number; list: [number, number, number, number][] };
}

interface CityData {
  header: CityHeader;
  /** Seven float32 per building, as `city.bin` holds them. */
  records: Float32Array;
  batches: CityBatch[];
}

const PLATFORM_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

let pending: Promise<CityData | undefined> | undefined;

/**
 * The city's two files, once per page, and nothing at all where they are
 * missing. A viewer whose `pnpm bundle` has not run draws the plateau with no
 * city rather than failing to draw anything.
 */
function loadCity(): Promise<CityData | undefined> {
  pending ??= (async () => {
    const base = import.meta.env.BASE_URL;
    const [headerRes, binRes] = await Promise.all([fetch(`${base}city/city.json`), fetch(`${base}city/city.bin`)]);
    if (!headerRes.ok || !binRes.ok) throw new Error(`city: ${headerRes.status} and ${binRes.status}`);
    const header = (await headerRes.json()) as CityHeader;
    const buffer = await binRes.arrayBuffer();
    if (!PLATFORM_IS_LITTLE_ENDIAN) throw new Error('city: the binary is little-endian and this machine is not');
    const records = new Float32Array(buffer);
    const expected = header.binary.count * CITY_STRIDE;
    if (records.length !== expected) {
      throw new Error(`city.bin: ${records.length} floats, but the header says ${header.binary.count} records`);
    }
    const cells = header.cells.list.map(([x, y, from, count]) => ({ x, y, from, count }));
    return { header, records, batches: cityBatches(cells, header.cells.size) };
  })().catch((error: unknown) => {
    console.warn('seked: no modern city;', error);
    return undefined;
  });
  return pending;
}

export interface CityProps {
  /** The plateau's own grid, which is the better ground where a building stands on it. */
  terrain: TerrainProps;
  /** The coarse grid, which is the only ground under most of the city. */
  desert: Omit<DesertProps, 'clippingPlanes'>;
  clippingPlanes: Plane[];
}

/**
 * The ground under a building: the fine grid inside its own square, the
 * coarse one beyond it.
 *
 * Sampling the coarse grid everywhere would be simpler and is wrong where it
 * matters: the westernmost of these buildings stand on the escarpment inside
 * the plateau's own grid, where sixty metres and twenty metres of sampling
 * differ by more than the three-metre skirt under a prism would hide, and a
 * block of flats standing in the air is the one thing a reader would see.
 */
function groundUnderCity(terrain: TerrainProps, desert: CityProps['desert']): (x: number, y: number) => number {
  const fine = groundSampler(terrain);
  const coarse = groundSampler({ ...desert, pyramids: [] });
  const half = ((terrain.header.nx - 1) * terrain.header.spacing) / 2;
  return (x, y) => (Math.abs(x) <= half && Math.abs(y) <= half ? fine(x, y) : coarse(x, y));
}

/** One batch, its two levels built as they are first asked for. */
interface Band {
  batch: CityBatch;
  /** The batch's centre and the radius that contains it, for the distance test. */
  centre: Vector3;
  radius: number;
  built: Partial<Record<CityLevel, BufferGeometry>>;
  drawn: Partial<Record<CityLevel, { drawn: number; measured: number }>>;
  lod: Lod;
}

/**
 * The city, batch by batch.
 *
 * Each batch is drawn at whichever of its two levels the camera's distance
 * asks for, through `chooseLod`, so a batch cannot flutter between levels on
 * a camera loitering at the line. A level is built the first time it is
 * wanted and kept, because the whole city at its near level is about
 * seventeen megabytes of vertices and building one batch is a few
 * milliseconds; building all thirty-two meshes up front would stall the frame
 * the timeline reached `today`.
 */
export function City({ terrain, desert, clippingPlanes }: CityProps): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const shown = useView((s) => s.layers.city);
  const camera = useThree((s) => s.camera);
  const [data, setData] = useState<CityData | undefined>(undefined);
  const [, redraw] = useState(0);

  // Fetched only once the timeline is at `today`, and then kept: a reader
  // stepping back and forth over the last stop does not fetch it twice.
  useEffect(() => {
    if (state !== 'today' || !shown || data) return;
    let alive = true;
    void loadCity().then((loaded) => {
      if (alive) setData(loaded);
    });
    return () => {
      alive = false;
    };
  }, [state, shown, data]);

  const ground = useMemo(() => groundUnderCity(terrain, desert), [terrain, desert]);

  const bands = useMemo<Band[]>(() => {
    if (!data) return [];
    return data.batches.map((batch) => {
      const half = batch.size / 2;
      return {
        batch,
        // The data frame is +Z up and the scene's group turns it, so a
        // batch's centre in three's own axes is (x, 0, -y).
        centre: new Vector3(batch.x + half, 0, -(batch.y + half)),
        radius: Math.SQRT2 * half,
        built: {},
        drawn: {},
        lod: newLod(),
      };
    });
  }, [data]);

  useEffect(
    () => () => {
      for (const band of bands) for (const geometry of Object.values(band.built)) geometry.dispose();
    },
    [bands],
  );

  // One pass a frame: how far each batch is, which level that asks for, and
  // building it where it has not been built. `chooseLod` holds the level
  // through its own hysteresis, so this is a distance test and not a swap.
  const world = useMemo(() => new Vector3(), []);
  const changed = useRef(0);
  useFrame(() => {
    if (!data || bands.length === 0) return;
    let moved = false;
    for (const band of bands) {
      band.centre.setY(camera.position.y);
      const distance = Math.max(0, camera.position.distanceTo(band.centre) - band.radius);
      const level: CityLevel = chooseLod(band.lod, distance, [LOOK.coarseMetres], 2) === 0 ? 'near' : 'far';
      if (band.built[level]) continue;
      const mesh = cityBatchMesh(data.records, band.batch, level, { groundLevel: ground });
      // `gridGeometry` and not `meshGeometry`: the prisms already carry their
      // own corners per face, so an indexed geometry's computed normals are
      // the faces' own, and splitting them again would triple seven million
      // vertices for nothing.
      band.built[level] = gridGeometry(mesh);
      band.drawn[level] = { drawn: mesh.drawn, measured: mesh.measured };
      moved = true;
    }
    if (moved) {
      changed.current += 1;
      redraw(changed.current);
    }
  });

  // One material for every batch, rather than one per mesh: they are the same
  // city, the patches are the same patches, and a material each would compile
  // the same program sixteen times.
  const material = useMemo(
    () => new MeshStandardMaterial({ color: LOOK.colour, roughness: LOOK.roughness, metalness: 0 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.clippingPlanes = clippingPlanes;
  }, [material, clippingPlanes]);
  const stone = useStone('sand');
  useEffect(() => {
    applyStone(material, stone, {
      strength: LOOK.stoneStrength,
      scale: LOOK.stoneScale,
      relief: LOOK.stoneRelief,
    });
  }, [material, stone]);
  useEffect(() => {
    applyAtmosphere(material);
  }, [material]);

  if (state !== 'today' || !shown || !data) return null;

  const { header } = data;
  // The hover tag shows the first sentence alone and cuts it at ninety-six
  // characters, so the source and the year of the imagery are the first
  // sentence and everything else follows for the About drawer.
  const note =
    `Context, not evidence: Google Open Buildings, imagery of ${header.heights.imageryYear}. ` +
    `Outlines from Open Buildings v3, heights sampled out of the Open Buildings 2.5D Temporal raster, whose ` +
    `stated mean absolute error is ${header.heights.meanAbsoluteErrorM} m. ` +
    `${header.heights.unmeasured.toLocaleString()} of the ${header.binary.count.toLocaleString()} buildings had ` +
    `no height the raster would vouch for and are drawn at the median height it measured for buildings as small ` +
    `as they are. Each is the best-fit box of its imported outline and not the outline, so nothing about any one ` +
    `building's shape is a measurement of it. No claim may cite the city.`;
  const seked = { name: 'Giza and Cairo, today', tier: 'context', note, state };

  return (
    <group name="city">
      {bands.map((band) => {
        const level: CityLevel = band.lod.level === 1 ? 'far' : 'near';
        const geometry = band.built[level] ?? band.built[level === 'near' ? 'far' : 'near'];
        if (!geometry) return null;
        return (
          <mesh
            key={`${band.batch.x},${band.batch.y}`}
            geometry={geometry}
            material={material}
            userData={{ seked }}
          />
        );
      })}
    </group>
  );
}
