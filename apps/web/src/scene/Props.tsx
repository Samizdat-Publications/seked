/**
 * The props: downloaded models placed by hand, as against the stand-ins, which
 * are fitted to a footprint.
 *
 * A stand-in answers "what does this outline look like"; a prop answers "what
 * stood here". Nobody surveyed a statue's place on a temple floor, so a prop's
 * placement is a look choice until a plan says otherwise, and every one of them
 * is written down in `blender/props.json` rather than computed here. This file
 * draws what that manifest says and decides nothing about where anything is.
 *
 * The one exception is the exception the manifest itself asks for. A prop may
 * name an `emplacements` key, and where the database has records under it
 * (`khafre_valley_temple.statue.1.east` and the rest, which Track L reads off
 * Hoelscher's plate) those records are used and the manifest's grid is not.
 * That is the only way a prop's placement stops being a look choice, and it
 * needs no change here when the records land.
 *
 * Everything is instanced: twenty-three kings are one draw call per level of
 * detail, not twenty-three scene graphs. The level is chosen per placement
 * from the camera's distance and the instance matrices are rewritten only when
 * the choice changes, which for a few dozen props is nothing at all.
 *
 * Nothing here is required. Where `props/manifest.json` is missing, because
 * `python scripts/props.py` and `pnpm web-assets` have not been run on this
 * machine, the scene is drawn without props and says nothing.
 */
import type { Environment } from '@seked/geometry';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Group,
  type Material,
  type Object3D,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useView } from '../store';
import { applyAtmosphere } from './Atmosphere';
import { chooseLod, newLod, type Lod } from './lod';
import { forgetCascades, receiveCascades } from './materials/shadows';
import { prepareStandinMaterial } from './Standins';

/** One anchor in the project frame: where a prop stands and which way it looks. */
export interface Placement {
  east: number;
  north: number;
  /** Metres above the Great Pyramid's base. The baker stood the model's own base at its origin, so this is the ground. */
  up: number;
  /** A compass bearing in degrees, clockwise from north, of the way the prop faces. */
  yaw: number;
  scale?: number;
}

/** One line of `apps/web/public/props/manifest.json`, as the props pass of `scripts/web-assets.ts` writes it. */
export interface PropEntry {
  id: string;
  kind: string;
  name: string;
  author?: string;
  url?: string;
  license: string;
  attribution: string;
  evidence?: string;
  note?: string;
  /** Where the database keeps this prop's surveyed places, when it has any. */
  emplacements?: { key: string; states: string[]; up: number; yaw: number };
  placements?: Record<string, Placement[]>;
  file: string;
  bytes: number;
  sha256: string;
  /** The node names in the GLB, coarsening in order. */
  lods: string[];
  size: [number, number, number];
}

/**
 * Camera distances at which the next level down takes over, in metres. Look
 * choices: a prop is a statue or a bush, not a pyramid, so the finest level is
 * worth carrying only while one fills a good part of the frame. Where the
 * swap actually happens, which is not quite on the line in a slow move, is
 * `lod.ts`'s.
 */
const LOD_METRES = [120, 600];

/** How many emplacements to look for under a key before giving up. More than any temple has. */
const MOST_EMPLACEMENTS = 200;

let manifest: Promise<PropEntry[]> | undefined;

/** The manifest, once, and an empty list where there is none to be had. */
export function loadProps(): Promise<PropEntry[]> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}props/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<PropEntry[]>) : []))
    .catch(() => []);
  return manifest;
}

/**
 * The places the database knows for a prop in this state, or nothing where it
 * knows none. Records are read from 1 upwards and stop at the first gap, so a
 * half-entered plate gives the emplacements that are in it and no holes.
 */
export function surveyedPlaces(entry: PropEntry, env: Environment, state: string): Placement[] | undefined {
  const spec = entry.emplacements;
  if (!spec || !spec.states.includes(state)) return undefined;
  const found: Placement[] = [];
  for (let n = 1; n <= MOST_EMPLACEMENTS; n++) {
    const east = env[`${spec.key}.${n}.east`];
    const north = env[`${spec.key}.${n}.north`];
    if (east === undefined || north === undefined) break;
    found.push({ east, north, up: spec.up, yaw: spec.yaw });
  }
  return found.length > 0 ? found : undefined;
}

/** Where a prop stands in this state: the database's places if it has them, else the manifest's. */
export function placementsFor(entry: PropEntry, env: Environment, state: string): Placement[] {
  return surveyedPlaces(entry, env, state) ?? entry.placements?.[state] ?? [];
}

/**
 * The honesty word for a prop in a state. The plan's rule exactly: what is
 * only in The First Time is that state's claim, and what also stands in the
 * as-built plateau is a reconstruction with a mainstream source behind it.
 */
export function propTier(state: string): string {
  return state === 'ancient' ? 'claim' : 'reconstruction';
}

const loaded = new Map<string, Promise<Group | undefined>>();

/** One GLB, parsed once and kept: two states may draw the same prop. */
function loadProp(file: string): Promise<Group | undefined> {
  let promise = loaded.get(file);
  if (!promise) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    useView.getState().setLoading(`props:${file}`, true);
    promise = loader
      .loadAsync(`${import.meta.env.BASE_URL}props/${file}`)
      .then((gltf) => gltf.scene)
      .catch((error: unknown) => {
        console.warn(`prop ${file} did not load`, error);
        return undefined;
      })
      .finally(() => useView.getState().setLoading(`props:${file}`, false));
    loaded.set(file, promise);
  }
  return promise;
}

export function Props({ env }: { env: Environment }): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const [entries, setEntries] = useState<PropEntry[]>([]);
  const [models, setModels] = useState<{ entry: PropEntry; scene: Group; places: Placement[] }[]>([]);

  useEffect(() => {
    let alive = true;
    void loadProps().then((all) => {
      if (alive) setEntries(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Only the props this state stands somewhere are fetched at all, so the
  // plants, which Track I scatters and which have no placements of their own,
  // cost nothing here.
  const wanted = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, places: placementsFor(entry, env, state) }))
        .filter(({ places }) => places.length > 0),
    [entries, env, state],
  );

  useEffect(() => {
    let alive = true;
    void Promise.all(
      wanted.map(({ entry, places }) => loadProp(entry.file).then((scene) => (scene ? { entry, scene, places } : undefined))),
    ).then((all) => {
      if (alive) setModels(all.filter((m): m is { entry: PropEntry; scene: Group; places: Placement[] } => m !== undefined));
    });
    return () => {
      alive = false;
    };
  }, [wanted]);

  if (models.length === 0) return null;
  return (
    <>
      {models.map(({ entry, scene, places }) => (
        <Prop key={entry.id} entry={entry} scene={scene} places={places} state={state} />
      ))}
    </>
  );
}

/** The meshes of one level of detail, each with the transform it carries inside its own level. */
interface Level {
  meshes: { mesh: Mesh; local: Matrix4 }[];
}

/**
 * The instance matrix of one placement: the model turned to its bearing,
 * scaled if the placement asks, and set down at its anchor, with whatever
 * transform the mesh carries inside its level applied first.
 *
 * The bearing is clockwise from north and the frame is right-handed with +Z
 * up, so a turn to a bearing is a turn of minus that angle about the vertical.
 */
function instanceMatrix(place: Placement, local: Matrix4, into: Matrix4): Matrix4 {
  const scale = place.scale ?? 1;
  return into
    .compose(
      new Vector3(place.east, place.north, place.up),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (-place.yaw * Math.PI) / 180),
      new Vector3(scale, scale, scale),
    )
    .multiply(local);
}

/** One prop, instanced at its placements, its levels of detail swapped by distance. */
function Prop({
  entry,
  scene,
  places,
  state,
}: {
  entry: PropEntry;
  scene: Group;
  places: Placement[];
  state: string;
}): React.JSX.Element {
  // The levels as they come out of the GLB, with the materials given the
  // scene's air, its shadows and the stand-ins' own surface treatment. The
  // model is shared between mounts, so this is done once per level here and
  // the instanced copies below carry no materials of their own.
  const levels = useMemo(() => {
    const found: Level[] = [];
    for (const name of entry.lods) {
      const node = scene.getObjectByName(name);
      if (!node) continue;
      node.updateMatrixWorld(true);
      const inverse = new Matrix4().copy(node.matrixWorld).invert();
      const meshes: { mesh: Mesh; local: Matrix4 }[] = [];
      node.traverse((child: Object3D) => {
        if (!(child instanceof Mesh)) return;
        meshes.push({ mesh: child, local: new Matrix4().multiplyMatrices(inverse, child.matrixWorld) });
      });
      found.push({ meshes });
    }
    return found;
  }, [scene, entry.lods]);

  const instanced = useMemo(
    () =>
      levels.map((level, index) =>
        level.meshes.map(({ mesh, local }) => {
          const instance = new InstancedMesh(mesh.geometry, mesh.material, places.length);
          instance.instanceMatrix.setUsage(DynamicDrawUsage);
          instance.castShadow = true;
          instance.receiveShadow = true;
          instance.frustumCulled = false;
          instance.count = 0;
          // Only the coarsest level answers the pointer: a raycast against a
          // hundred thousand triangles on every mouse move would cost more
          // than the label is worth, and the coarse one names the same statue.
          if (index < levels.length - 1) instance.raycast = () => undefined;
          return { instance, local };
        }),
      ),
    [levels, places.length],
  );

  // What the pointer is told this is. `Hover.tsx` walks up from whatever it
  // hits, so the tag on the group answers for every instance under it.
  const tag = useMemo(
    () => ({
      name: entry.name,
      tier: propTier(state),
      note: `${entry.evidence ?? 'stand-in'}. ${entry.note ?? ''} ${entry.attribution}`.replace(/\s+/g, ' ').trim(),
      state,
    }),
    [entry, state],
  );

  // Every material gets the air and a cascade of the sun's shadow map, which
  // is what `useStoneMaterial` does for everything built from our own geometry.
  useEffect(() => {
    const materials = new Set<Material>();
    for (const level of levels) {
      for (const { mesh } of level.meshes) {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material);
        }
      }
    }
    for (const material of materials) {
      prepareStandinMaterial(material);
      applyAtmosphere(material);
      receiveCascades(material);
    }
    return () => {
      for (const material of materials) forgetCascades(material);
    };
  }, [levels]);

  // Which level each placement is drawn at, rewritten only when the camera has
  // moved far enough to change one of them. Each emplacement keeps its own
  // hysteresis, so a row of kings along a causeway is not swapped as one and
  // none of them is swapped on the frame the line is crossed.
  const chosen = useMemo(() => places.map(() => -1), [places]);
  const lods = useMemo(() => places.map(() => newLod()), [places]);
  const scratch = useMemo(() => new Matrix4(), []);
  const world = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    if (instanced.length === 0) return;
    let changed = false;
    for (const [i, place] of places.entries()) {
      // The camera is in three's frame, which is this one turned Y-up, so the
      // placement is read across rather than the camera brought back.
      const distance = world.set(place.east, place.up, -place.north).distanceTo(camera.position);
      const level = chooseLod(lods[i] as Lod, distance, LOD_METRES, instanced.length);
      if (chosen[i] !== level) {
        chosen[i] = level;
        changed = true;
      }
    }
    if (!changed) return;
    for (const [level, meshes] of instanced.entries()) {
      let n = 0;
      for (const [i, place] of places.entries()) {
        if (chosen[i] !== level) continue;
        for (const { instance, local } of meshes) instance.setMatrixAt(n, instanceMatrix(place, local, scratch));
        n++;
      }
      for (const { instance } of meshes) {
        instance.count = n;
        instance.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group userData={{ seked: tag }}>
      {instanced.flat().map(({ instance }, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <primitive key={`${entry.id}-${i}`} object={instance} />
      ))}
    </group>
  );
}
