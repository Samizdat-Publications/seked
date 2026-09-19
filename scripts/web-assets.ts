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
import { Document, NodeIO, Primitive, type Node, type Scene, type Texture } from '@gltf-transform/core';
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

/**
 * The errors a RATIO level may fall back through when the plan's own bound
 * will not reach its ratio.
 *
 * The same fault the budget was invented for, in the place nobody looked for
 * it next. A ratio and an error bound are two demands and the bound wins, so
 * on a photogrammetric scan the coarse levels simply do not happen:
 * `khafre-seated` came out with lod1 and lod2 both at 316,745 triangles
 * against lod0's 359,327, and `boulder` at 62,272 against 66,122, which is a
 * distance swap that swaps nothing and a prop that costs its finest level at
 * every range (logged as a stage 5 leftover, fixed 2026-09-19).
 *
 * So a ratio level is now a demand too: `LOD_ERROR` is tried first, because
 * where it reaches the ratio it is the most faithful, and where it does not
 * the bound gives way. A statue seen from a hundred metres may lose a
 * twentieth of its radius; a statue drawn at three hundred thousand triangles
 * at that distance is drawn at a great many triangles a pixel.
 */
const LOD_ERRORS = [LOD_ERROR, 0.01, 0.05, 0.2] as const;

/** How far past its ratio a level may land and still be taken as having reached it. */
const LOD_TOLERANCE = 1.1;

/**
 * meshopt's sloppy simplifier, wearing the ordinary one's coat.
 *
 * The last resort, and why one is needed. `khafre-seated` is a photogrammetric
 * scan whose triangles barely share vertices: welded and deduped it still
 * loses only twelve per cent of its faces at an error bound of 0.2, because
 * the ordinary simplifier collapses edges and there are hardly any edges to
 * collapse, only islands. `simplifySloppy` does not collapse edges. It
 * reclusters the surface in space and is allowed to change the topology, which
 * is exactly what a scan of a statue seen from fifty metres can afford and a
 * surveyed pyramid could not.
 *
 * It is only ever reached after `LOD_ERRORS` has failed, it is only used for
 * the coarse levels, and it never touches anything in `data/`: a prop is a
 * look choice standing where this repo says, and the shape of the scan behind
 * it is the author's, not a measurement. `gltf-transform` asks its simplifier
 * for `simplify`, so the swap is a wrapper and nothing else changes.
 */
const SLOPPY_SIMPLIFIER = {
  ...MeshoptSimplifier,
  /**
   * The two take their arguments differently and the difference is one
   * argument in the middle, so it is spelled out rather than forwarded:
   * `simplify` is (indices, positions, stride, targetCount, error, flags),
   * which is how `gltf-transform` calls it, and `simplifySloppy` is
   * (indices, positions, stride, vertexLock, targetCount, error). Checked
   * against the build rather than against the types, which disagree with it.
   */
  simplify(
    indices: Uint32Array,
    positions: Float32Array,
    stride: number,
    targetCount: number,
    error: number,
    _flags?: readonly string[],
  ): [Uint32Array, number] {
    const sloppy = MeshoptSimplifier.simplifySloppy as unknown as (
      indices: Uint32Array,
      positions: Float32Array,
      stride: number,
      vertexLock: Uint8Array | null,
      targetCount: number,
      error: number,
    ) => [Uint32Array, number];
    return sloppy(indices, positions, stride, null, targetCount, error);
  },
} as unknown as typeof MeshoptSimplifier;

/** How far the sloppy pass may move the surface, as a share of the model's radius. A look choice. */
const SLOPPY_ERROR = 0.05;

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
  /**
   * The far ring's billboard, where the prop has one: the file beside the GLB,
   * and the metres its square stands for, so the viewer's quads are the size
   * of the plant they replaced.
   */
  card?: { file: string; metres: number };
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
  // The same last resort the ratio levels take, and the scatter level is the
  // one that can most afford it: it is what a plant is drawn as from the far
  // side of the plateau, where its silhouette is a few pixels across.
  const clone = cloneDocument(doc);
  await clone.transform(simplify({ simplifier: SLOPPY_SIMPLIFIER, ratio, error: SLOPPY_ERROR, lockBorder: false }));
  const sloppy = triangleCount(clone);
  if (sloppy < (best as { triangles: number }).triangles) {
    console.log(`${id}: ${SCATTER_LEVEL} is ${sloppy} triangles of ${base} by the sloppy simplifier, budget ${budget}`);
    return { doc: clone, triangles: sloppy };
  }
  const reached = (best as { doc: Document; triangles: number }).triangles;
  console.log(
    `${id}: ${SCATTER_LEVEL} is ${reached} triangles of ${base} and misses the budget of ${budget}; `
      + 'neither simplifier will go further on this topology',
  );
  return best as { doc: Document; triangles: number };
}

/**
 * One ratio level: the finest level simplified toward `ratio` of its faces,
 * with the error bound relaxed through `LOD_ERRORS` until the ratio is met
 * within `LOD_TOLERANCE`. Where the plan's own bound reaches it, which is the
 * ordinary case, nothing else is tried and the level is exactly what it was
 * before this existed.
 */
async function ratioLevel(
  doc: Document,
  base: number,
  ratio: number,
  name: string,
  id: string,
): Promise<{ doc: Document; triangles: number }> {
  const target = Math.max(1, Math.ceil(base * ratio));
  let best: { doc: Document; triangles: number } | undefined;
  for (const error of LOD_ERRORS) {
    const clone = cloneDocument(doc);
    await clone.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }));
    const reached = triangleCount(clone);
    if (!best || reached < best.triangles) best = { doc: clone, triangles: reached };
    if (reached <= target * LOD_TOLERANCE) {
      if (error !== LOD_ERROR) {
        console.log(`${id}: ${name} is ${reached} triangles of ${base}, asked for ${target}, at the relaxed error ${error}`);
      }
      return best;
    }
    console.log(`${id}: ${name} reached only ${reached} triangles at error ${error}, over the ${target} its ratio asks for`);
  }
  // The ordinary simplifier is out of moves. If this is a coarse level, let
  // the sloppy one reshape the surface rather than ship a level that swaps
  // nothing; if it is not, keep what the faithful pass reached.
  if (name !== 'lod0') {
    const clone = cloneDocument(doc);
    await clone.transform(
      simplify({ simplifier: SLOPPY_SIMPLIFIER, ratio, error: SLOPPY_ERROR, lockBorder: false }),
    );
    const sloppy = triangleCount(clone);
    if (sloppy < (best as { triangles: number }).triangles) {
      console.log(`${id}: ${name} is ${sloppy} triangles of ${base} by the sloppy simplifier, asked for ${target}`);
      return { doc: clone, triangles: sloppy };
    }
  }
  const reached = (best as { doc: Document; triangles: number }).triangles;
  console.log(
    `${id}: ${name} is ${reached} triangles of ${base} and misses the ${target} its ratio asks for; `
      + 'neither simplifier will go further on this topology',
  );
  return best as { doc: Document; triangles: number };
}

/**
 * A material that says it is transparent, over a texture with no alpha in it,
 * is not transparent. It is an opaque material paying a transparent one's
 * price.
 *
 * `island-tree`, the acacia stand-in, is the case this was written for: its
 * leaves declare `BLEND` and their base colour is a three-channel JPEG, so
 * every leaf draws fully opaque anyway, and draws in the sorted pass without
 * writing depth, which is the one way to make a tree cost more than its
 * triangles. The exporter's metadata simply did not match the textures it
 * shipped beside it, and the baker believed it.
 *
 * So the alpha mode is set from what the texture actually carries. Nothing is
 * invented: an alpha channel that is not there is not manufactured out of the
 * colours, and a material whose base colour factor is itself transparent is
 * left alone.
 */
async function tellTheTruthAboutAlpha(doc: Document, id: string): Promise<void> {
  for (const material of doc.getRoot().listMaterials()) {
    if (material.getAlphaMode() === 'OPAQUE') continue;
    if ((material.getBaseColorFactor()[3] ?? 1) < 1) continue;
    const texture = material.getBaseColorTexture();
    const image = texture?.getImage();
    if (!image) continue;
    const meta = await sharp(Buffer.from(image)).metadata();
    if (meta.hasAlpha) continue;
    console.log(
      `${id}: ${material.getName() || '(unnamed material)'} declared ${material.getAlphaMode()} over a `
        + `${meta.channels}-channel ${meta.format} with no alpha in it; drawn opaque`,
    );
    material.setAlphaMode('OPAQUE');
  }
}

/** What a prop's levels came to: the node names in order, the triangles in each, and the card's own triangles. */
interface Levels {
  names: string[];
  triangles: Record<string, number>;
  /**
   * The scatter level's triangles with their textures, kept for the card
   * baker. Read before the levels are merged, because merging empties the
   * document the scatter level was built in.
   */
  card?: CardPart[];
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
    const name = `lod${i + 1}`;
    const level = await ratioLevel(doc, base, ratio, name, id);
    triangles[name] = level.triangles;
    coarser.push({ name, doc: level.doc });
  }
  let card: CardPart[] | undefined;
  if (budget !== undefined) {
    const level = await scatterLevel(doc, base, budget, id);
    triangles[SCATTER_LEVEL] = level.triangles;
    card = await cardParts(level.doc);
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
  return { names: ['lod0', ...coarser.map((c) => c.name)], triangles, card };
}

// --- The far ring's card ---------------------------------------------------
//
// Beyond `LOOK.cardMetres` a scattered plant is two crossed quads carrying a
// picture of itself, and this is where the picture is made.
//
// It is a render and not a swatch. The plan allowed either: a render of the
// scatter level from two sides, or the crown's own leaf texture laid on the
// quads. The swatch was not taken, because a plant's base colour texture is
// an atlas of bark and leaves and laying it on a quad draws an atlas rather
// than a tree. So the baker rasterises: the scatter level's own triangles,
// orthographic, once along north and once along east, sampling each triangle's
// own base colour texture at its own UVs, with a depth buffer so the near
// surface wins. Four by four supersampling and a box filter down to
// `CARD_PIXELS` give the silhouette its soft edge, and a pixel no triangle
// covered stays transparent, which is what makes the card a plant shape and
// not a square.
//
// Nothing here is Blender and nothing here is a GPU: it is a hundred lines of
// edge functions, which is what an orthographic render of three thousand
// triangles actually is. The alternative was a headless renderer in the asset
// pipeline, which is a dependency and a driver for a 256 pixel picture.
//
// The two views go side by side in one image, the view from the south in the
// left half and the view from the west in the right, so a card is one texture
// and one draw and the crossed quads take one half each.

/** The card's square, per view. A plant on the far ring is a few dozen pixels tall, so this is generous. */
const CARD_PIXELS = 256;

/** How many samples a side each card pixel is rasterised from, before the box filter. A look choice. */
const CARD_SUPERSAMPLE = 4;

/** How big a plant's own textures are decoded to for sampling. Bigger buys nothing at 256 pixels. */
const CARD_TEXTURE_PIXELS = 512;

/** One triangle soup with its texture, as the rasteriser wants it. */
interface CardPart {
  /** Data-frame positions, three floats a vertex, three vertices a triangle. */
  positions: Float32Array;
  /** The same vertices' texture coordinates, two floats each. */
  uvs: Float32Array | undefined;
  /** The base colour texture as straight RGBA, and its size. */
  texture: { data: Uint8Array; width: number; height: number } | undefined;
  /** The material's base colour factor, which multiplies the texture. */
  factor: readonly number[];
  /** Below this the fragment is not drawn at all. */
  cutoff: number;
}

/**
 * The triangles of a document, flattened with their textures decoded, ready to
 * rasterise. Read before the levels are merged, because merging empties the
 * clone the scatter level was built in.
 */
async function cardParts(doc: Document): Promise<CardPart[]> {
  const decoded = new Map<Texture, CardPart['texture']>();
  const parts: CardPart[] = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== Primitive.Mode.TRIANGLES) continue;
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const positions = new Float32Array(count * 3);
      const uv = primitive.getAttribute('TEXCOORD_0');
      const uvs = uv ? new Float32Array(count * 2) : undefined;
      for (let i = 0; i < count; i++) {
        const v = indices ? indices.getScalar(i) : i;
        positions.set(position.getElement(v, [0, 0, 0]), i * 3);
        if (uv && uvs) uvs.set(uv.getElement(v, [0, 0]), i * 2);
      }
      const material = primitive.getMaterial();
      const source = material?.getBaseColorTexture() ?? undefined;
      let texture: CardPart['texture'];
      if (source) {
        if (!decoded.has(source)) {
          const image = source.getImage();
          const raw = image
            ? await sharp(Buffer.from(image))
                .resize(CARD_TEXTURE_PIXELS, CARD_TEXTURE_PIXELS, { fit: 'fill' })
                .ensureAlpha()
                .raw()
                .toBuffer()
            : undefined;
          decoded.set(source, raw ? { data: new Uint8Array(raw), width: CARD_TEXTURE_PIXELS, height: CARD_TEXTURE_PIXELS } : undefined);
        }
        texture = decoded.get(source);
      }
      parts.push({
        positions,
        uvs,
        texture,
        factor: material?.getBaseColorFactor() ?? [1, 1, 1, 1],
        // A leaf drawn on a transparent quad is dropped where its texture
        // calls the quad empty, whatever the material's alpha mode says; a
        // texture with no alpha channel at all reads 255 everywhere and is
        // unaffected.
        cutoff: material?.getAlphaMode() === 'MASK' ? (material.getAlphaCutoff() ?? 0.5) : 0.5,
      });
    }
  }
  return parts;
}

/** One orthographic view: which data-frame axis runs across the picture, and which runs into it. */
interface CardView {
  across: 0 | 1;
  /** The axis into the picture. The nearer of two surfaces has the smaller value along it. */
  into: 0 | 1;
}

/**
 * Rasterise one view into straight RGBA at `side` pixels square.
 *
 * Orthographic, so there is no perspective divide and the barycentric weights
 * are the edge functions themselves. The picture is `metres` across and
 * `metres` tall with the plant's foot on the bottom edge and its middle on the
 * vertical centre line, which is exactly where the card's quad stands in the
 * scene, so a card is the same size as the plant it replaced.
 */
function rasterise(parts: readonly CardPart[], view: CardView, metres: number, side: number): Uint8Array {
  const out = new Uint8Array(side * side * 4);
  const depth = new Float32Array(side * side).fill(Infinity);
  const scale = side / metres;
  const half = side / 2;
  for (const part of parts) {
    const { positions, uvs, texture, factor, cutoff } = part;
    const sx = [0, 0, 0];
    const sy = [0, 0, 0];
    const sz = [0, 0, 0];
    for (let t = 0, tri = 0; t + 8 < positions.length; t += 9, tri++) {
      for (let k = 0; k < 3; k++) {
        sx[k] = (positions[t + k * 3 + view.across] as number) * scale + half;
        // The image's own y runs down from the top, and the plant's foot is at
        // z = 0, which is the bottom edge.
        sy[k] = side - (positions[t + k * 3 + 2] as number) * scale;
        sz[k] = positions[t + k * 3 + view.into] as number;
      }
      const area = ((sx[1] as number) - (sx[0] as number)) * ((sy[2] as number) - (sy[0] as number))
        - ((sx[2] as number) - (sx[0] as number)) * ((sy[1] as number) - (sy[0] as number));
      if (area === 0) continue;
      const x0 = Math.max(0, Math.floor(Math.min(sx[0] as number, sx[1] as number, sx[2] as number)));
      const x1 = Math.min(side - 1, Math.ceil(Math.max(sx[0] as number, sx[1] as number, sx[2] as number)));
      const y0 = Math.max(0, Math.floor(Math.min(sy[0] as number, sy[1] as number, sy[2] as number)));
      const y1 = Math.min(side - 1, Math.ceil(Math.max(sy[0] as number, sy[1] as number, sy[2] as number)));
      const uvAt = tri * 6;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = (((sx[1] as number) - px) * ((sy[2] as number) - py) - ((sx[2] as number) - px) * ((sy[1] as number) - py)) / area;
          const w1 = (((sx[2] as number) - px) * ((sy[0] as number) - py) - ((sx[0] as number) - px) * ((sy[2] as number) - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * (sz[0] as number) + w1 * (sz[1] as number) + w2 * (sz[2] as number);
          const at = y * side + x;
          if (z >= (depth[at] as number)) continue;
          let r = 255;
          let g = 255;
          let b = 255;
          let a = 255;
          if (texture && uvs) {
            const u = w0 * (uvs[uvAt] as number) + w1 * (uvs[uvAt + 2] as number) + w2 * (uvs[uvAt + 4] as number);
            const v = w0 * (uvs[uvAt + 1] as number) + w1 * (uvs[uvAt + 3] as number) + w2 * (uvs[uvAt + 5] as number);
            const tx = Math.min(texture.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * texture.width)));
            const ty = Math.min(texture.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * texture.height)));
            const p = (ty * texture.width + tx) * 4;
            r = texture.data[p] as number;
            g = texture.data[p + 1] as number;
            b = texture.data[p + 2] as number;
            a = texture.data[p + 3] as number;
          }
          if (a / 255 < cutoff) continue;
          depth[at] = z;
          out[at * 4] = Math.round(r * (factor[0] as number));
          out[at * 4 + 1] = Math.round(g * (factor[1] as number));
          out[at * 4 + 2] = Math.round(b * (factor[2] as number));
          out[at * 4 + 3] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * The box filter down to the card's own size, with the colour weighted by
 * coverage. Averaging an empty pixel's colour in would drag every edge toward
 * black, which is the one artefact a billboard cannot hide.
 */
function downsample(big: Uint8Array, side: number, factor: number): Uint8Array {
  const small = side / factor;
  const out = new Uint8Array(small * small * 4);
  for (let y = 0; y < small; y++) {
    for (let x = 0; x < small; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let j = 0; j < factor; j++) {
        for (let i = 0; i < factor; i++) {
          const p = ((y * factor + j) * side + x * factor + i) * 4;
          if ((big[p + 3] as number) === 0) continue;
          r += big[p] as number;
          g += big[p + 1] as number;
          b += big[p + 2] as number;
          covered++;
        }
      }
      if (covered === 0) continue;
      const at = (y * small + x) * 4;
      out[at] = Math.round(r / covered);
      out[at + 1] = Math.round(g / covered);
      out[at + 2] = Math.round(b / covered);
      out[at + 3] = Math.round((covered / (factor * factor)) * 255);
    }
  }
  return out;
}

/**
 * The card for one plant: the two views side by side in one WebP, and the
 * metres its square stands for, which is what the viewer scales the quads to.
 */
async function bakeCard(parts: readonly CardPart[], size: readonly number[], id: string): Promise<{ image: Uint8Array; metres: number }> {
  // One square for both views and both axes, so the card keeps the plant's own
  // proportions and the two quads are the same size as each other.
  const metres = Math.max(size[0] as number, size[1] as number, size[2] as number);
  const big = CARD_PIXELS * CARD_SUPERSAMPLE;
  const views: CardView[] = [
    // From the south looking north: east runs across, north runs in.
    { across: 0, into: 1 },
    // From the west looking east: north runs across, east runs in.
    { across: 1, into: 0 },
  ];
  const halves = views.map((view) => downsample(rasterise(parts, view, metres, big), big, CARD_SUPERSAMPLE));
  const atlas = new Uint8Array(CARD_PIXELS * 2 * CARD_PIXELS * 4);
  for (const [k, half] of halves.entries()) {
    for (let y = 0; y < CARD_PIXELS; y++) {
      const from = y * CARD_PIXELS * 4;
      atlas.set(half.subarray(from, from + CARD_PIXELS * 4), (y * CARD_PIXELS * 2 + k * CARD_PIXELS) * 4);
    }
  }
  const image = await sharp(Buffer.from(atlas), { raw: { width: CARD_PIXELS * 2, height: CARD_PIXELS, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  let covered = 0;
  for (let p = 3; p < atlas.length; p += 4) if ((atlas[p] as number) > 0) covered++;
  console.log(
    `${id}: card is ${CARD_PIXELS * 2} by ${CARD_PIXELS} px over ${metres.toFixed(2)} m, `
      + `${((covered / (CARD_PIXELS * CARD_PIXELS * 2)) * 100).toFixed(0)} per cent of it covered, ${(image.byteLength / 1e3).toFixed(0)} kB`,
  );
  return { image: new Uint8Array(image), metres };
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
      await tellTheTruthAboutAlpha(doc, entry.id);
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
    let card: WebProp['card'];
    if (levels.card) {
      const baked = await bakeCard(levels.card, size, entry.id);
      const cardFile = `${entry.id}-card.webp`;
      writeFileSync(join(PROPS_OUT, cardFile), baked.image);
      card = { file: cardFile, metres: baked.metres };
    }
    manifest.push({
      ...entry,
      file,
      bytes: out.byteLength,
      sha256: createHash('sha256').update(out).digest('hex'),
      source_sha256: entry.sha256,
      lods: levels.names,
      levels: levels.triangles,
      size,
      ...(card ? { card } : {}),
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
