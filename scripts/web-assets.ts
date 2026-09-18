/**
 * The viewer's stand-ins, from the GLBs Blender bakes.
 *
 *     pnpm web-assets            # reads build/web-models, writes apps/web/public/models
 *     SEKED_BUILD=<dir> pnpm web-assets
 *
 * `blender/export_web.py` does the fitting and hands over honest but heavy
 * files: three levels of detail and 4k PBR maps, a few tens of megabytes each.
 * This is the other half of the baker. Each one goes through gltf-transform:
 * dedup and prune what the export left over, weld the vertices a GLB splits
 * along its UV seams, resize every texture to 2048 and encode it as WebP, then
 * compress the geometry with meshopt, which the viewer decodes with three's own
 * decoder.
 *
 * Nothing here moves a vertex in the frame: the fit is the render's and is
 * already baked in. Quantisation rounds positions to about five millimetres
 * over a seventy-five metre statue, which is three orders below the metre the
 * OSM registration is good to.
 *
 * No file may pass 20 MB, because Cloudflare Pages refuses anything over
 * 25 MiB; one that does is encoded again at 1024, and if it still will not fit
 * this stops and names it rather than shipping a site that cannot be deployed.
 *
 * The outputs are generated and gitignored, and the viewer draws no stand-in at
 * all where they are missing, so this exits quietly when Blender has not run.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO, Primitive, type Node, type Scene } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  clearNodeTransform,
  cloneDocument,
  dedup,
  flatten,
  getBounds,
  join as joinMeshes,
  mergeDocuments,
  meshopt,
  prune,
  simplify,
  textureCompress,
  unpartition,
  weld,
} from '@gltf-transform/functions';
import { REPO_ROOT } from '@seked/data';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

/** The build directory to read the baked GLBs from; another checkout's, when a worktree has none of its own. */
const BUILD = process.env.SEKED_BUILD ?? join(REPO_ROOT, 'build');
const SOURCE = join(BUILD, 'web-models');
const OUT = join(REPO_ROOT, 'apps', 'web', 'public', 'models');

/** Cloudflare Pages refuses a file over 25 MiB; 20 MB leaves room and is the plan's limit. */
const LIMIT_BYTES = 20_000_000;

/** Texture sizes to try, largest first. 2048 is the spec's; 1024 is the retry for a file that will not fit. */
const SIZES = [2048, 1024] as const;

/** What `blender/export_web.py` writes beside the GLBs. Only the fields the viewer or this script reads are named. */
interface BakedEntry {
  id: string;
  name: string;
  file: string;
  bytes: number;
  states: string[];
  variant?: string;
  default_in?: string[];
  evidence?: string;
  finish?: string;
  material?: string;
  replaces: string[];
  author?: string;
  url?: string;
  license: string;
  attribution: string;
  lods: string[];
  faces?: Record<string, number>;
  fit?: Record<string, number>;
}

/** One line of apps/web/public/models/manifest.json. */
interface WebEntry extends BakedEntry {
  sha256: string;
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Everything but the texture size is the same on every pass, so the two attempts differ in one number only. */
async function compress(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  const doc = await io.readBinary(bytes);
  await doc.transform(
    dedup(),
    // The frame empty carries no mesh and every LOD node carries the manifest
    // entry, so leaves and extras are both kept whatever else goes.
    prune({ keepLeaves: true, keepExtras: true }),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  return io.writeBinary(doc);
}

async function main(): Promise<void> {
  const index = join(SOURCE, 'index.json');
  if (!existsSync(index)) {
    console.log(`web-assets: no ${index}; the viewer will show no stand-ins (run blender/export_web.py first)`);
    return;
  }
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;

  const baked = (JSON.parse(readFileSync(index, 'utf8')) as { models: BakedEntry[] }).models;
  // A model dropped from the manifest must not linger in public/, where the
  // viewer would go on fetching it from an older manifest in a reader's cache.
  if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const manifest: WebEntry[] = [];
  const oversize: string[] = [];
  for (const entry of baked) {
    const source = join(SOURCE, entry.file);
    if (!existsSync(source)) {
      console.log(`${entry.id}: no ${source}; skipped`);
      continue;
    }
    const before = readFileSync(source);
    let out: Uint8Array | undefined;
    let used = 0;
    for (const size of SIZES) {
      out = await compress(before, size);
      used = size;
      if (out.byteLength <= LIMIT_BYTES) break;
      console.log(`${entry.id}: ${(out.byteLength / 1e6).toFixed(1)} MB at ${size} px is over the ${LIMIT_BYTES / 1e6} MB limit`);
    }
    if (!out) continue;
    if (out.byteLength > LIMIT_BYTES) {
      oversize.push(`${entry.id} (${(out.byteLength / 1e6).toFixed(1)} MB)`);
      continue;
    }
    writeFileSync(join(OUT, entry.file), out);
    manifest.push({ ...entry, bytes: out.byteLength, sha256: createHash('sha256').update(out).digest('hex') });
    console.log(`${entry.id}: ${(before.byteLength / 1e6).toFixed(1)} MB to ${(out.byteLength / 1e6).toFixed(1)} MB, textures at ${used} px`);
  }

  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${join(OUT, 'manifest.json')} with ${manifest.length} models, ${(manifest.reduce((a, m) => a + m.bytes, 0) / 1e6).toFixed(1)} MB in all`);
  if (oversize.length > 0) {
    throw new Error(`these stand-ins are still over ${LIMIT_BYTES / 1e6} MB at ${SIZES[SIZES.length - 1]} px and cannot be served: ${oversize.join(', ')}`);
  }
}

// --- The props pass -------------------------------------------------------
//
// A stand-in replaces a footprint and was fitted to it in Blender, so the
// models pass above moves nothing. A prop is the other kind of asset: a model
// downloaded whole and placed by hand at the anchors in `blender/props.json`.
// Nobody has fitted it, so this pass is where it is brought into the frame,
// and it is the only place that ever touches a prop's vertices.
//
// What the bake does, in order, and nothing else:
//
//   1. glTF is Y-up and the project frame is Z-up, so the model is turned a
//      quarter turn about X. This is the same turn `blender/export_web.py`
//      cancels on the way out, run the other way on the way in.
//   2. `front` says which way the model faces in its own file. It is turned
//      about the vertical until it faces +y, so that a placement's `yaw` is a
//      compass bearing and means the same thing for every prop.
//   3. `scale_to` is a size in metres of the object itself, so the model is
//      scaled uniformly until its height or its longest horizontal extent is
//      that. A scan's own units are arbitrary and this is the only honest way
//      to read them; the number cited is always the object's size and never a
//      measurement of Giza.
//   4. The model is centred over its own footprint and stood on the ground,
//      sunk by `ground_z`. A consumer then places it at the ground and needs
//      no offset of its own, which is what Track I's scatter is promised.
//
// Nothing about the form changes: the turn is a right angle, the scale is
// uniform, and the decimation is meshopt's simplifier at the plan's ratios,
// which moves vertices only by removing them.
const PROPS_SOURCE = join(BUILD, 'props');
const PROPS_OUT = join(REPO_ROOT, 'apps', 'web', 'public', 'props');

/** The plan's levels of detail: the source, a quarter of it and a sixteenth, by face count. */
const LOD_RATIOS = [1, 0.25, 0.06] as const;

/** How far simplification may move the surface, as a share of the model's size. The plan's figure. */
const LOD_ERROR = 0.001;

/**
 * The one extra level a scattered plant gets, baked to a triangle budget
 * rather than to a ratio.
 *
 * Why it exists. A ratio and an error bound are two demands on the simplifier
 * and the error bound wins: at `LOD_ERROR` of 0.001 it stops long before the
 * ratio on a mesh dense enough to need it. The island tree, the acacia
 * stand-in, came out of the coarsest ratio level at 169,160 triangles across
 * three meshes, and `Vegetation.tsx` instances that 700 times, which is 118
 * million triangles a frame before the shadow passes ever run. The date
 * palm's coarsest was 9,531, another 6.7 million. Together they were why the
 * built and ancient states drew at five frames a second and the today state
 * at a hundred and eighty (director, 2026-09-18).
 *
 * So the budget leads and the error bound gives way. The ratio asked for is
 * the budget over what the finest level actually has, and the error is
 * relaxed until the budget is met: a plant seen from across the plateau may
 * lose its silhouette by a twentieth of its own radius and nobody will ever
 * see it, while a tree drawn at a hundred and sixty thousand triangles at
 * that distance is a tree drawn at one pixel a triangle.
 *
 * The budgets themselves are in `blender/props.json` as `scatter_to`, with
 * the sentence that chose each one. They are look choices and no part of any
 * measurement.
 *
 * One caution. The level goes into the manifest's `lods` as the plan asks, so
 * a prop that had both a `scatter_to` and placements of its own would gain a
 * fourth level in `Props.tsx`'s distance swap. Only the plants carry a
 * budget, and the plants have no placements, so that prop does not exist.
 */
const SCATTER_LEVEL = 'scatter';

/**
 * How far the scatter level's simplifier may move the surface, as a share of
 * the model's radius, tried in this order until the budget is met. The plan's
 * two figures.
 */
const SCATTER_ERRORS = [0.05, 0.2] as const;

/** Where the budgets live, which is the manifest the props are declared in and not the index the fetch writes. */
const PROPS_MANIFEST = join(REPO_ROOT, 'blender', 'props.json');

/** Texture sizes to try for a prop, largest first. A prop is small on screen beside a stand-in. */
const PROP_SIZES = [1024, 512] as const;

/** One line of `build/props/index.json`, as `scripts/props.py` writes it. */
interface PropEntry {
  id: string;
  kind: string;
  name: string;
  author?: string;
  url?: string;
  license: string;
  attribution: string;
  evidence?: string;
  note?: string;
  /** Which way the source model faces before a placement's yaw is applied. */
  front?: '+x' | '-x' | '+y' | '-y';
  /** How far the base is sunk below the ground it is placed on, in metres. */
  ground_z?: number;
  scale_to?: { height_m?: number; length_m?: number };
  /** The nodes of the source to keep, where a pack ships several variations of the same plant in one file. */
  keep_nodes?: string[];
  /** The share of the source's faces the finest level keeps, for a source too heavy to ship whole. */
  decimate_to?: number;
  placements?: Record<string, { east: number; north: number; up: number; yaw: number; scale?: number }[]>;
  source: Record<string, string>;
  file: string;
  sha256: string;
}

/** One line of `apps/web/public/props/manifest.json`. */
interface WebProp extends PropEntry {
  bytes: number;
  /**
   * The node names in the GLB, coarsening in order, as the stand-ins' manifest
   * uses them, with `scatter` last where the prop has a budget.
   */
  lods: string[];
  /** How many triangles each of those levels draws, so the viewer's cost is a number and not a guess. */
  levels: Record<string, number>;
  /** The baked model's extent in metres, east, north and up. */
  size: [number, number, number];
  /** The sha256 of the source file this was baked from, which `blender/props.json` pins. */
  source_sha256: string;
}

/**
 * Throw away anything that is not a triangle. Khufu's ship carries a point
 * cloud beside its mesh, which the simplifier cannot decimate and the scene
 * cannot draw; a prop is a surface or it is nothing.
 */
function dropLoosePrimitives(doc: Document, id: string): void {
  let dropped = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() === Primitive.Mode.TRIANGLES) continue;
      mesh.removePrimitive(primitive);
      primitive.dispose();
      dropped++;
    }
  }
  if (dropped > 0) console.log(`${id}: dropped ${dropped} primitive(s) that are not triangles`);
}

/**
 * Keep only the named nodes of a source scene. Poly Haven's plant packs ship
 * several variations of the same bush side by side in one file, which would
 * otherwise scatter as a row of five wherever Track I asked for one.
 */
function keepNodes(doc: Document, names: string[], id: string): void {
  const scene = doc.getRoot().getDefaultScene() ?? (doc.getRoot().listScenes()[0] as Scene);
  const kept: string[] = [];
  for (const node of scene.listChildren()) {
    if (names.includes(node.getName())) {
      kept.push(node.getName());
      continue;
    }
    scene.removeChild(node);
    node.dispose();
  }
  console.log(`${id}: kept ${kept.join(', ') || 'nothing'} of the source's variations`);
}

/** How big a prop's source is on disk: a Poly Haven model is a .gltf beside a .bin and its textures. */
function folderBytes(folder: string): number {
  if (!existsSync(folder)) return 0;
  let total = 0;
  for (const name of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, name.name);
    total += name.isDirectory() ? folderBytes(path) : statSync(path).size;
  }
  return total;
}

/** How far the model is turned about the vertical to make `front` point north, in radians. */
function frontTurn(front: PropEntry['front']): number {
  if (front === '+x') return Math.PI / 2;
  if (front === '-x') return -Math.PI / 2;
  if (front === '-y') return Math.PI;
  return 0;
}

/**
 * The linear part of the bake, as a row-major 3 by 3 applied to a source
 * vertex: a quarter turn about X to stand the model up, then `turn` about the
 * vertical, then a uniform scale.
 */
function linear(turn: number, scale: number): number[][] {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return [
    [scale * c, 0, scale * s],
    [scale * s, 0, -scale * c],
    [0, scale, 0],
  ];
}

function apply(m: number[][], v: readonly number[]): [number, number, number] {
  return [0, 1, 2].map((i) => (m[i] as number[]).reduce((a, x, j) => a + x * (v[j] as number), 0)) as [number, number, number];
}

/** The box of the eight transformed corners of a box: exact here, because every turn is a right angle. */
function turnedBounds(box: { min: number[]; max: number[] }, m: number[][]): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const v = [0, 1, 2].map((i) => ((corner >> i) & 1 ? box.max[i] : box.min[i]) as number);
    const w = apply(m, v);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i] as number, w[i] as number);
      max[i] = Math.max(max[i] as number, w[i] as number);
    }
  }
  return { min, max };
}

/** Bake a matrix into every mesh under a scene, leaving every node's transform the identity. */
function bake(scene: Scene, matrix: number[]): void {
  const walk = (node: Node, parent: number[]): void => {
    node.setMatrix(multiply(parent, node.getMatrix() as unknown as number[]) as never);
    const children = node.listChildren();
    clearNodeTransform(node);
    for (const child of children) walk(child, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };
  for (const node of scene.listChildren()) walk(node, matrix);
}

/** Column-major 4 by 4 product, a then b, as glTF stores them. */
function multiply(b: number[], a: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += (b[k * 4 + row] as number) * (a[col * 4 + k] as number);
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * `scatter_to.triangles` out of `blender/props.json`, by prop id.
 *
 * Read from the manifest the props are declared in rather than from
 * `build/props/index.json`, because that index carries a fixed list of fields
 * written by `scripts/props.py`, which is the fetching half of the pipeline
 * and has nothing to do with how heavy a level is baked. Reading the manifest
 * here also means a budget can be changed and the props re-baked without
 * fetching a single byte again.
 */
function scatterBudgets(): Map<string, number> {
  if (!existsSync(PROPS_MANIFEST)) return new Map();
  const declared = JSON.parse(readFileSync(PROPS_MANIFEST, 'utf8')) as {
    props?: { id: string; scatter_to?: { triangles?: number } }[];
  };
  const out = new Map<string, number>();
  for (const prop of declared.props ?? []) {
    const budget = prop.scatter_to?.triangles;
    if (typeof budget === 'number' && budget > 0) out.set(prop.id, budget);
  }
  return out;
}

/** How many triangles a document draws, counted the way the renderer counts them: three indices to a triangle. */
function triangleCount(doc: Document): number {
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== Primitive.Mode.TRIANGLES) continue;
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : (primitive.getAttribute('POSITION')?.getCount() ?? 0);
      total += Math.floor(count / 3);
    }
  }
  return total;
}

/**
 * The scatter level: the finest level simplified toward `budget` triangles,
 * with the error bound relaxed through `SCATTER_ERRORS` until the budget is
 * met. The ratio is the budget over what the model actually has, which is the
 * whole difference from the ratio levels above: it is a count and not a share.
 */
async function scatterLevel(
  doc: Document,
  base: number,
  budget: number,
  id: string,
): Promise<{ doc: Document; triangles: number }> {
  const ratio = Math.min(1, budget / Math.max(base, 1));
  let best: { doc: Document; triangles: number } | undefined;
  for (const error of SCATTER_ERRORS) {
    const clone = cloneDocument(doc);
    await clone.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }));
    const reached = triangleCount(clone);
    if (!best || reached < best.triangles) best = { doc: clone, triangles: reached };
    if (reached <= budget) {
      console.log(`${id}: ${SCATTER_LEVEL} is ${reached} triangles of ${base}, budget ${budget}, at error ${error}`);
      return best;
    }
    console.log(`${id}: ${SCATTER_LEVEL} reached only ${reached} triangles at error ${error}, over the budget of ${budget}`);
  }
  const reached = (best as { doc: Document; triangles: number }).triangles;
  console.log(
    `${id}: ${SCATTER_LEVEL} is ${reached} triangles of ${base} and misses the budget of ${budget}; `
      + 'the simplifier will not go further on this topology',
  );
  return best as { doc: Document; triangles: number };
}

/** What a prop's levels came to: the node names in order, and the triangles in each. */
interface Levels {
  names: string[];
  triangles: Record<string, number>;
}

/**
 * The levels of detail of one prop in one GLB, each under a node named `lod0`,
 * `lod1`, `lod2`, and `scatter` where the prop has a budget, which is the same
 * contract the stand-ins' manifest uses so the viewer swaps them the same way.
 */
async function lods(doc: Document, finest: number, budget: number | undefined, id: string): Promise<Levels> {
  const scene = doc.getRoot().getDefaultScene() ?? (doc.getRoot().listScenes()[0] as Scene);
  if (finest < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: finest, error: LOD_ERROR }));
  const base = triangleCount(doc);
  const triangles: Record<string, number> = { lod0: base };
  const coarser: { name: string; doc: Document }[] = [];
  for (const [i, ratio] of LOD_RATIOS.slice(1).entries()) {
    const clone = cloneDocument(doc);
    await clone.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: LOD_ERROR }));
    const name = `lod${i + 1}`;
    triangles[name] = triangleCount(clone);
    coarser.push({ name, doc: clone });
  }
  if (budget !== undefined) {
    const level = await scatterLevel(doc, base, budget, id);
    triangles[SCATTER_LEVEL] = level.triangles;
    coarser.push({ name: SCATTER_LEVEL, doc: level.doc });
  }
  const wrap = (name: string, children: Node[]): void => {
    const node = doc.createNode(name);
    for (const child of children) node.addChild(child);
    scene.addChild(node);
  };
  wrap('lod0', scene.listChildren());
  for (const { name, doc: clone } of coarser) {
    const map = mergeDocuments(doc, clone);
    const merged = map.get(clone.getRoot().getDefaultScene() ?? (clone.getRoot().listScenes()[0] as Scene)) as Scene;
    const children = merged.listChildren();
    for (const child of children) merged.removeChild(child);
    wrap(name, children);
    merged.dispose();
  }
  return { names: ['lod0', ...coarser.map((c) => c.name)], triangles };
}

async function props(): Promise<void> {
  const index = join(PROPS_SOURCE, 'index.json');
  if (!existsSync(index)) {
    console.log(`web-assets: no ${index}; the viewer will show no props (run python scripts/props.py first)`);
    return;
  }
  await MeshoptSimplifier.ready;
  const entries = (JSON.parse(readFileSync(index, 'utf8')) as { props: PropEntry[] }).props;
  const budgets = scatterBudgets();
  if (existsSync(PROPS_OUT)) for (const f of readdirSync(PROPS_OUT)) rmSync(join(PROPS_OUT, f), { recursive: true });
  mkdirSync(PROPS_OUT, { recursive: true });

  const manifest: WebProp[] = [];
  const oversize: string[] = [];
  for (const entry of entries) {
    const source = join(PROPS_SOURCE, ...entry.file.split('/'));
    if (!existsSync(source)) {
      console.log(`${entry.id}: no ${source}; skipped`);
      continue;
    }
    const sourceBytes = folderBytes(join(PROPS_SOURCE, entry.id));
    let out: Uint8Array | undefined;
    let used = 0;
    let size: [number, number, number] = [0, 0, 0];
    let levels: Levels = { names: [], triangles: {} };
    for (const px of PROP_SIZES) {
      const doc = await io.read(source);
      dropLoosePrimitives(doc, entry.id);
      if (entry.keep_nodes) keepNodes(doc, entry.keep_nodes, entry.id);
      await doc.transform(dedup(), flatten(), joinMeshes(), prune(), weld());
      const scene = doc.getRoot().getDefaultScene() ?? (doc.getRoot().listScenes()[0] as Scene);

      // The measure, then the bake. Both read the same box, so a prop that
      // came down in centimetres and one in metres end the same size.
      const box = getBounds(scene);
      const turn = frontTurn(entry.front);
      const stood = turnedBounds(box, linear(turn, 1));
      const height = (stood.max[2] as number) - (stood.min[2] as number);
      const length = Math.max((stood.max[0] as number) - (stood.min[0] as number), (stood.max[1] as number) - (stood.min[1] as number));
      const target = entry.scale_to?.height_m ?? entry.scale_to?.length_m;
      const extent = entry.scale_to?.height_m === undefined ? length : height;
      const scale = target === undefined || !(extent > 0) ? 1 : target / extent;
      const m = linear(turn, scale);
      const scaled = turnedBounds(box, m);
      const centre = [0, 1].map((i) => (((scaled.min[i] as number) + (scaled.max[i] as number)) / 2));
      const matrix = [
        m[0]?.[0], m[1]?.[0], m[2]?.[0], 0,
        m[0]?.[1], m[1]?.[1], m[2]?.[1], 0,
        m[0]?.[2], m[1]?.[2], m[2]?.[2], 0,
        -(centre[0] as number), -(centre[1] as number), -(scaled.min[2] as number) - (entry.ground_z ?? 0), 1,
      ] as number[];
      bake(scene, matrix);
      size = [0, 1, 2].map((i) => Number(((scaled.max[i] as number) - (scaled.min[i] as number)).toFixed(3))) as [number, number, number];

      levels = await lods(doc, entry.decimate_to ?? 1, budgets.get(entry.id), entry.id);
      await doc.transform(
        // The coarse levels came from documents of their own and brought
        // their buffers with them; a GLB may have only one.
        unpartition(),
        dedup(),
        prune({ keepLeaves: true, keepExtras: true }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [px, px] }),
        meshopt({ encoder: MeshoptEncoder, level: 'high' }),
      );
      out = await io.writeBinary(doc);
      used = px;
      if (out.byteLength <= LIMIT_BYTES) break;
      console.log(`${entry.id}: ${(out.byteLength / 1e6).toFixed(1)} MB at ${px} px is over the ${LIMIT_BYTES / 1e6} MB limit`);
    }
    if (!out) continue;
    if (out.byteLength > LIMIT_BYTES) {
      oversize.push(`${entry.id} (${(out.byteLength / 1e6).toFixed(1)} MB)`);
      continue;
    }
    const file = `${entry.id}.glb`;
    writeFileSync(join(PROPS_OUT, file), out);
    manifest.push({
      ...entry,
      file,
      bytes: out.byteLength,
      sha256: createHash('sha256').update(out).digest('hex'),
      source_sha256: entry.sha256,
      lods: levels.names,
      levels: levels.triangles,
      size,
    });
    console.log(
      `${entry.id}: ${(sourceBytes / 1e6).toFixed(1)} MB to ${(out.byteLength / 1e6).toFixed(1)} MB, textures at ${used} px, ${size.join(' by ')} m`,
    );
  }

  writeFileSync(join(PROPS_OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${join(PROPS_OUT, 'manifest.json')} with ${manifest.length} props, ${(manifest.reduce((a, p) => a + p.bytes, 0) / 1e6).toFixed(1)} MB in all`);
  if (oversize.length > 0) {
    throw new Error(`these props are still over ${LIMIT_BYTES / 1e6} MB at ${PROP_SIZES[PROP_SIZES.length - 1]} px and cannot be served: ${oversize.join(', ')}`);
  }
}

await main();
await props();
