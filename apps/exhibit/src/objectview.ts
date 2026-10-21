/**
 * An object in the hand (docs/exhibit-2026-10.md, "Objects in the hand"): a small realtime view of one object, lit
 * simply on a dark ground and turned by dragging, on a leaf whose `interact` is `object:<id>`. Imported lazily, so
 * three.js loads only when such a leaf is reached. The first object is the ghosted head (`objects/heads.json`,
 * written by render/export_heads.py): the as-built king's head solid, the First Time lion's head translucent round
 * it, and H1's enlargement read from the same file. The second is the Great Pyramid with chapter 6's numbers drawn
 * on it (src/pyramidobject.ts), built from the database with no file at all.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type PyramidObject, toThree } from './pyramidobject';

export interface HeadsManifest {
  centre: number[];
  objects: { id: string; file: string; role: 'solid' | 'ghost' }[];
  head_scale: { used: number; least: number | null };
  standin: string;
  /** The box the export cut both heads out of, in project metres (render/export_heads.py). */
  crop?: { box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } };
}

/** What the view says of H1 beside the heads: the least enlargement the fit found, or only the renders' choice. */
export function factorLine(m: HeadsManifest): string {
  const { used, least } = m.head_scale;
  return least !== null && least !== undefined
    ? `On these stand-ins the lion's head had to be about ${least.toFixed(2)} times the size drawn from the photographs before the monument's head would fit inside it (H1, a proposal, not yet a claim). The renders use ${used}.`
    : `The lion's head is drawn ${used} times the size of the photographs' lion here, a look choice; the fit that finds the least enlargement was not run for this export.`;
}

/**
 * How far inside the export's crop box the view cuts the heads again (metres), a look choice: the export's own cut is
 * the decimated mesh's ragged edge, so the view cuts each face of the box this much further in, where the cut is a
 * clean plane, and fills it as stone.
 */
export const HEAD_INSET = 1.0;
/** The cut under the chin goes further in: the export's lower edge runs ragged through the nemes' lappets. */
export const HEAD_INSET_BELOW = 2.5;

export interface ClipBox { min: [number, number, number]; max: [number, number, number] }

/**
 * The crop box in the heads' glTF frame (+x east, +y up, -z north, about `centre`), each face moved `inset` inwards:
 * the clean cut the view makes. Null when the manifest carries no crop.
 */
export function headClip(m: HeadsManifest, inset = HEAD_INSET, below = HEAD_INSET_BELOW): ClipBox | null {
  const b = m.crop?.box;
  if (!b) return null;
  const [cx, cy, cz] = m.centre as [number, number, number];
  return {
    min: [b.x0 - cx + inset, b.z0 - cz + below, -(b.y1 - cy) + inset],
    max: [b.x1 - cx - inset, b.z1 - cz - inset, -(b.y0 - cy) - inset],
  };
}

/**
 * Where the head starts: a front three-quarter view from the north-east, a little above, where the lion's mane is
 * seen to wrap the king's head (the statue faces east, +x, which a turn of -90 degrees brings to the viewer).
 */
export const HEAD_HOME = { yaw: -0.85, pitch: 0.12 };
/** The two heads framed to this many times their largest half-extent. */
const HEAD_MARGIN = 0.85;

const GHOST_OPACITY = 0.3;
/** The colour the cut faces are filled with: the stone in shadow, so a cut reads as a sawn face, not a hole. */
const CUT_STONE = 0x4a3d2e;
/** The lines drawn on the pyramid: the claim's gold, and a quiet grey for north. */
const CLAIM_GOLD = 0xf2c46b;
const NORTH_GREY = 0x9a9488;

export class ObjectView {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  private group = new THREE.Group();
  private turn = { yaw: 0.6, pitch: 0.15 };
  private home = { yaw: 0.6, pitch: 0.15 };
  private frame = 0;
  private loaded: string | null = null;
  /** The clean cut through the heads, in the group's own frame; turned with it before each draw. */
  private clipLocal: THREE.Plane[] = [];
  private clipWorld: THREE.Plane[] = [];
  private lights: THREE.Object3D[] = [];

  constructor(host: HTMLElement, private base: URL) {
    this.el = document.createElement('figure');
    this.el.className = 'object';
    this.el.innerHTML = `<div class="object-view"><canvas aria-label="The king's head inside the lion's. Drag to turn it."></canvas></div>
      <button type="button" class="object-reset">Reset</button><figcaption></figcaption>`;
    host.append(this.el);
    const canvas = this.el.querySelector('canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0f0e0c);
    this.renderer.localClippingEnabled = true;
    this.scene.add(this.group);
    this.daylight();
    this.el.querySelector('.object-reset')!.addEventListener('click', () => { this.turn = { ...this.home }; this.draw(); });
    let drag: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.turn.yaw += (e.clientX - drag.x) * 0.01;
      this.turn.pitch = Math.max(-1.2, Math.min(1.2, this.turn.pitch + (e.clientY - drag.y) * 0.01));
      drag = { x: e.clientX, y: e.clientY };
      this.draw();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    window.addEventListener('resize', () => this.draw());
  }

  /** The pyramid's light: a sky and a low morning sun. */
  private daylight(): void {
    this.setLights([new THREE.HemisphereLight(0xfff4e0, 0x2a241c, 1.1), at(new THREE.DirectionalLight(0xffffff, 2.2), -4, 6, 8)]);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.el.classList.remove('museum');
  }

  /**
   * A museum case's light for a carved object: a warm key high at the front left, a cool fill low from the right, a
   * rim behind that draws the outline off the dark, and little ambient, so the carving is read by its shadows.
   */
  private museum(): void {
    this.setLights([
      new THREE.HemisphereLight(0xf3eadb, 0x1a1712, 0.35),
      at(new THREE.DirectionalLight(0xffe2bd, 3.2), -6, 7, 6),
      at(new THREE.DirectionalLight(0xb9c8dc, 0.7), 7, -1, 4),
      at(new THREE.DirectionalLight(0xfff1dc, 2.4), 2, 4, -9),
    ]);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.el.classList.add('museum');
  }

  private setLights(ls: THREE.Object3D[]): void {
    for (const l of this.lights) this.scene.remove(l);
    this.lights = ls;
    for (const l of ls) this.scene.add(l);
  }

  /** Show the heads of `m` (loaded once), the caption beside them. */
  async show(m: HeadsManifest): Promise<void> {
    this.el.hidden = false;
    this.museum();
    this.el.querySelector('figcaption')!.textContent = `${factorLine(m)} ${m.standin}`;
    this.el.querySelector('canvas')!.setAttribute('aria-label', "The king's head inside the lion's. Drag to turn it.");
    const key = m.objects.map((o) => o.file).join();
    if (this.loaded !== key) {
      this.loaded = key;
      this.group.clear();
      const box = headClip(m);
      this.clipLocal = box ? [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min[0]), new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max[0]),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min[1]), new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max[1]),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min[2]), new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max[2]),
      ] : [];
      this.clipWorld = this.clipLocal.map((p) => p.clone());
      const loader = new GLTFLoader();
      const parts = await Promise.all(m.objects.map(async (o) => {
        const gltf = await loader.loadAsync(new URL(o.file, this.base).href);
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshes.push(n as THREE.Mesh); });
        for (const mesh of meshes) {
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mt) => {
            const g = (mt as THREE.MeshStandardMaterial).clone();
            g.clippingPlanes = this.clipWorld;
            // the ghost both sides: the crop opens the lion's face, and its inside fills the outline as faint stone
            g.side = o.role === 'ghost' ? THREE.DoubleSide : THREE.FrontSide;
            if (o.role === 'ghost') {
              g.transparent = true;
              g.opacity = GHOST_OPACITY;
              g.depthWrite = false;
            }
            return g;
          });
          mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
          if (o.role === 'ghost') mesh.renderOrder = 1;   // after the solid head, so the head shows through the ghost
          else {
            // the cut filled: the solid's inside, seen only where the clean cut has opened it, drawn as flat stone
            mesh.add(new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: CUT_STONE, side: THREE.BackSide, clippingPlanes: this.clipWorld })));
          }
        }
        gltf.scene.userData.role = o.role;
        return gltf.scene;
      }));
      parts.forEach((p) => this.group.add(p));
      // framed on what the clean cut leaves of both heads, turned about its middle, so the pair fills the card
      const shown = new THREE.Box3();
      for (const p of parts) shown.union(clippedBox(p, box));
      if (shown.isEmpty()) shown.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
      const half = shown.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      this.frameGroup(shown.getCenter(new THREE.Vector3()), HEAD_HOME, Math.max(half.x, half.y, half.z) * HEAD_MARGIN);
    }
    this.draw();
  }

  /** Show the Great Pyramid with its lines; `caption` says what they are. */
  showPyramid(p: PyramidObject, caption: string): void {
    this.el.hidden = false;
    this.daylight();
    this.el.querySelector('figcaption')!.textContent = caption;
    this.el.querySelector('canvas')!.setAttribute('aria-label', 'The Great Pyramid with a circle of radius its height round it and its golden triangle inside. Drag to turn it.');
    const key = `pyramid:${p.side}:${p.height}`;
    if (this.loaded !== key) {
      this.loaded = key;
      this.group.clear();
      this.clipLocal = [];
      this.clipWorld = [];
      const pos = new Float32Array(p.mesh.positions.length);
      for (let i = 0; i < pos.length; i += 3) pos.set(toThree([p.mesh.positions[i]!, p.mesh.positions[i + 1]!, p.mesh.positions[i + 2]!]), i);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(p.mesh.indices, 1));
      geo.computeVertexNormals();
      this.group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.9, flatShading: true, side: THREE.DoubleSide })));
      const ground = new THREE.Mesh(new THREE.CircleGeometry(p.height * 1.08, 96), new THREE.MeshStandardMaterial({ color: 0x2a251d, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      this.group.add(ground);
      // the lines are drawn over the stone, so the triangle shows through the solid it is cut from
      const line = (pts: number[][], color: number) => {
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(...toThree(q)))),
          new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
        l.renderOrder = 2;
        this.group.add(l);
      };
      line(p.circle, CLAIM_GOLD);
      line(p.triangle, CLAIM_GOLD);
      line(p.north, NORTH_GREY);
      // turned about the middle of its height, seen from a little above so the circle on the ground reads
      // framed on the circle and the apex, the reach of what is drawn, not on the ground's box
      this.frameGroup(new THREE.Vector3(0, p.height / 3, 0), { yaw: 0.55, pitch: 0.42 }, p.height * 1.25);
    }
    this.draw();
  }

  /** Centre the group's turning on `pivot`, frame all of it (or `reach` about the pivot), and set where Reset goes. */
  private frameGroup(pivot: THREE.Vector3, home: { yaw: number; pitch: number }, reach?: number): void {
    this.group.children.forEach((c) => c.position.sub(pivot));
    const radius = reach ?? new THREE.Box3().setFromObject(this.group).getBoundingSphere(new THREE.Sphere()).radius;
    const d = radius / Math.sin((this.camera.fov / 2) * Math.PI / 180) * 1.05;
    this.camera.position.set(0, 0, d);
    this.camera.near = d / 50;
    this.camera.far = d * 4;
    this.camera.lookAt(0, 0, 0);
    this.home = { ...home };
    this.turn = { ...home };
  }

  hide(): void { this.el.hidden = true; }

  private draw(): void {
    if (this.frame || this.el.hidden) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const c = this.renderer.domElement;
      const w = c.clientWidth || 1, h = c.clientHeight || 1;
      if (c.width !== Math.round(w * this.renderer.getPixelRatio()) || c.height !== Math.round(h * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      this.group.rotation.set(this.turn.pitch, this.turn.yaw, 0, 'YXZ');
      this.group.updateMatrixWorld(true);
      this.clipLocal.forEach((p, i) => this.clipWorld[i]!.copy(p).applyMatrix4(this.group.matrixWorld));
      this.renderer.render(this.scene, this.camera);
    });
  }
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T { o.position.set(x, y, z); return o; }

/** `obj`'s box once cut by `box`: what of it is shown. */
function clippedBox(obj: THREE.Object3D, box: ClipBox | null): THREE.Box3 {
  const b = new THREE.Box3().setFromObject(obj);
  if (box) b.intersect(new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max)));
  return b;
}
