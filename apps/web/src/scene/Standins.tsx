/**
 * The visual stand-ins: third-party and generated models fitted to the OSM
 * outlines they replace, exported from Blender by `blender/export_web.py`,
 * compressed by `scripts/web-assets.ts` and listed in
 * `public/models/manifest.json`. Every one is labelled with its source and
 * evidence tier when hovered, and nothing about its form is a measurement.
 *
 * The fit is not repeated here. A GLB's own coordinates are the data frame in
 * metres, because Blender did the fit and turned the model to cancel the glTF
 * exporter's Y-up, so the statue needs no transform at all inside the one
 * rotated group in `Scene.tsx`: it stands where the render stands it.
 *
 * Which model a state shows is `render_standins.chosen` again, in the same
 * words: a model belongs to the states it names, a variant is shown only when
 * asked for, and a variant that names a state in `default_in` is that state's
 * ordinary model. The variant the reader has asked for is the view's own
 * `sphinx`, which `ui/Sphinx.tsx` sets and the URL carries.
 *
 * Nothing here is required. Where the manifest is missing, because Blender has
 * not been run on this machine, the viewer draws the OSM prisms as before and
 * says nothing.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box3,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useView } from '../store';
import { Label } from './Label';

/** One line of `apps/web/public/models/manifest.json`, as `scripts/web-assets.ts` writes it. */
export interface StandinEntry {
  id: string;
  name: string;
  file: string;
  bytes: number;
  sha256: string;
  /** The timeline stops this model belongs to. Empty means every one of them. */
  states: string[];
  /** A claim's alternative, such as the lion or the Anubis head; absent for the ordinary model. */
  variant?: string;
  /** The states in which this variant is nonetheless the ordinary model. */
  default_in?: string[];
  evidence?: string;
  finish?: string;
  material?: string;
  /** The footprint ids whose OSM prisms this model stands in place of. */
  replaces: string[];
  author?: string;
  url?: string;
  license: string;
  attribution: string;
  /** The node names in the GLB, coarsening in order. */
  lods: string[];
}

/**
 * Camera distances at which the next level down takes over, in metres. Look
 * choices: 300k faces are worth carrying while the statue fills the frame and
 * are wasted from across the plateau.
 */
const LOD_METRES = [400, 1500];

/** Line spacing of the hover plaque, in CSS pixels, so the lines keep their spacing at any distance. */
const LINE_PX = 19;

let manifest: Promise<StandinEntry[]> | undefined;

/** The manifest, once, and an empty list when there is none to be had. */
export function loadManifest(): Promise<StandinEntry[]> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}models/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<StandinEntry[]>) : []))
    .catch(() => []);
  return manifest;
}

const loaded = new Map<string, Promise<Group | undefined>>();

/** One GLB, parsed once and kept: two states never draw the same file at the same time. */
function loadModel(file: string): Promise<Group | undefined> {
  let promise = loaded.get(file);
  if (!promise) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    promise = loader
      .loadAsync(`${import.meta.env.BASE_URL}models/${file}`)
      .then((gltf) => gltf.scene)
      .catch((error: unknown) => {
        console.warn(`stand-in ${file} did not load`, error);
        return undefined;
      });
    loaded.set(file, promise);
  }
  return promise;
}

/**
 * The one place a stand-in's surface is set up, and the place the director adds
 * the air to. Track A's `scene/Atmosphere.ts` will want its shader chunk in
 * every material the plateau draws; one call here gives it every stand-in.
 * Until then this only makes sure a generated model is drawn the way the rest
 * of the scene is.
 */
export function prepareStandinMaterial(material: Material): void {
  material.side = FrontSide;
  const standard = material as MeshStandardMaterial;
  if (standard.isMeshStandardMaterial) {
    // A 2k colour map on a seventy-five metre statue is coarse; anisotropy
    // keeps it from smearing at the grazing angles the plateau is seen from.
    if (standard.map) standard.map.anisotropy = 8;
    standard.envMapIntensity = 1;
  }
}

/**
 * `render_standins.chosen`, as the viewer sees it. Models are grouped by the
 * outlines they replace so that exactly one of each group is drawn: the
 * variant asked for, else the variant this state makes its default, else the
 * plain model.
 */
export function chosen(entries: readonly StandinEntry[], state: string, variant: string | null): StandinEntry[] {
  const live = entries.filter((e) => e.states.length === 0 || e.states.includes(state));
  const groups = new Map<string, StandinEntry[]>();
  for (const entry of live) {
    // The grouping exists so that only one model ever stands on a given set of
    // outlines. An entry that replaces none, such as a part of the whole-plateau
    // reconstruction, competes with nothing and is its own group.
    const key = entry.replaces.length > 0 ? [...entry.replaces].sort().join(' ') : `id:${entry.id}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const picked: StandinEntry[] = [];
  for (const group of groups.values()) {
    const wanted = variant === null ? [] : group.filter((e) => e.variant === variant);
    const byDefault = group.filter((e) => e.default_in?.includes(state));
    const plain = byDefault.length > 0 ? byDefault : group.filter((e) => !e.variant);
    const one = wanted[0] ?? plain[0];
    if (one) picked.push(one);
  }
  return picked;
}

/**
 * The first sentence of an attribution, for a label that has one line to say
 * whose this is, cut at `limit` characters so the plaque does not run off the
 * side of the screen. The whole attribution is in the manifest and belongs in
 * the About drawer; this is the credit in passing that the honesty rules ask
 * to be shown wherever a stand-in is drawn.
 */
export function firstSentence(text: string, limit = 120): string {
  const stop = /[.!?](\s|$)/.exec(text);
  const sentence = stop ? text.slice(0, stop.index + 1) : text;
  if (sentence.length <= limit) return sentence;
  const cut = sentence.slice(0, limit);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), limit - 12))}...`;
}

export function Standins(): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const variant = useView((s) => s.sphinx);
  const setHiddenMasses = useView((s) => s.setHiddenMasses);
  const [entries, setEntries] = useState<StandinEntry[]>([]);
  const [models, setModels] = useState<{ entry: StandinEntry; scene: Group }[]>([]);

  useEffect(() => {
    let alive = true;
    void loadManifest().then((all) => {
      if (alive) setEntries(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  // A variant asked for wins over the state's own model; null is the state's
  // own, which for `ancient` is itself a claim variant (the black Anubis) by
  // way of `default_in`.
  const wanted = useMemo(() => chosen(entries, state, variant), [entries, state, variant]);

  useEffect(() => {
    let alive = true;
    void Promise.all(
      wanted.map((entry) => loadModel(entry.file).then((scene) => (scene ? { entry, scene } : undefined))),
    ).then((all) => {
      if (alive) setModels(all.filter((m): m is { entry: StandinEntry; scene: Group } => m !== undefined));
    });
    return () => {
      alive = false;
    };
  }, [wanted]);

  // A prism and a statue must not stand in the same place, so the outlines a
  // loaded model covers are published for Pyramids.tsx to leave out. They are
  // published only once the model is in hand: a stand-in that fails to load
  // leaves the OSM solid standing rather than a hole.
  useEffect(() => {
    setHiddenMasses(new Set(models.flatMap((m) => m.entry.replaces)));
    return () => setHiddenMasses(new Set());
  }, [models, setHiddenMasses]);

  if (models.length === 0) return null;
  return (
    <>
      {models.map(({ entry, scene }) => (
        <Standin key={entry.id} entry={entry} scene={scene} state={state} />
      ))}
    </>
  );
}

/**
 * The model's extent in its own space, which is the data frame. Taken from the
 * geometry rather than from `Box3.setFromObject`, whose answer is in world
 * space and so depends on whether the model has been put in the scene yet.
 */
function localBounds(scene: Group): Box3 {
  const box = new Box3();
  const relative = new Matrix4();
  scene.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(scene.matrixWorld).invert();
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.computeBoundingBox();
    const bounds = child.geometry.boundingBox;
    if (bounds) box.union(bounds.clone().applyMatrix4(relative.multiplyMatrices(inverse, child.matrixWorld)));
  });
  return box;
}

/** One fitted model: its levels of detail swapped by distance, and its label on hover. */
function Standin({ entry, scene, state }: { entry: StandinEntry; scene: Group; state: string }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const world = useMemo(() => new Vector3(), []);

  // What the pointer is told this is. Track H's `Hover.tsx` reads the same
  // `userData.seked` off every object in the scene, so a stand-in says the
  // same thing whether the sprite below or the hover tag is showing.
  useEffect(() => {
    scene.userData.seked = {
      name: entry.name,
      tier: 'stand-in',
      note: `${entry.evidence ?? 'stand-in'}${entry.finish ? `, ${entry.finish}` : ''}. ${entry.attribution}`,
      state,
    };
  }, [scene, entry, state]);

  const { lods, centre, top } = useMemo(() => {
    const found: Object3D[] = [];
    for (const [level, name] of entry.lods.entries()) {
      const node = scene.getObjectByName(name);
      if (!node) continue;
      found.push(node);
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          prepareStandinMaterial(material);
        }
        // Only the coarsest level answers the pointer, whichever is drawn: a
        // 300k-face brute-force raycast on every mouse move would cost more
        // than the label is worth, and 15k faces name the same statue.
        if (level < entry.lods.length - 1) child.raycast = () => undefined;
      });
    }
    const box = localBounds(scene);
    const middle = box.getCenter(new Vector3());
    return { lods: found, centre: middle, top: new Vector3(middle.x, middle.y, box.max.z) };
  }, [scene, entry.lods]);

  useFrame(({ camera }) => {
    if (lods.length === 0) return;
    const distance = scene.localToWorld(world.copy(centre)).distanceTo(camera.position);
    const level = LOD_METRES.findIndex((limit) => distance < limit);
    const active = level === -1 ? lods.length - 1 : Math.min(level, lods.length - 1);
    for (const [i, node] of lods.entries()) node.visible = i === active;
  });

  const hover = (on: boolean) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(on);
  };

  return (
    <>
      <primitive object={scene} onPointerOver={hover(true)} onPointerOut={hover(false)} />
      {hovered && (
        <Plaque
          anchor={[top.x, top.y, top.z]}
          lines={[
            `${entry.name} (stand-in)`,
            `${entry.finish ? `${entry.finish}, ` : ''}evidence: ${entry.evidence ?? 'stand-in'}`,
            firstSentence(entry.attribution),
          ]}
        />
      )}
    </>
  );
}

/**
 * Several lines of Label, stacked. Each sprite keeps a constant height on
 * screen for itself; the spacing between them has to be given the same
 * treatment, or the lines pile up as the camera pulls away. The offsets are in
 * the data frame's own up, which is near enough screen-up from every viewpoint
 * the plateau is looked at from.
 */
function Plaque({ anchor, lines }: { anchor: [number, number, number]; lines: string[] }): React.JSX.Element {
  const group = useRef<Group>(null);
  const world = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const node = group.current;
    if (!node) return;
    node.getWorldPosition(world);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
    const perPixel = (2 * world.distanceTo(camera.position) * Math.tan((fov * Math.PI) / 360)) / size.height;
    node.children.forEach((child, i) => child.position.set(0, 0, perPixel * LINE_PX * (lines.length - 1 - i)));
  });
  return (
    <group ref={group} position={anchor}>
      {lines.map((text, i) => (
        <Label key={text} text={text} position={[0, 0, 0]} px={i === 0 ? 15 : 12} colour={i === 0 ? '#f2e6cf' : '#c8d2de'} />
      ))}
    </group>
  );
}
