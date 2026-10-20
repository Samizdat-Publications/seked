/**
 * An object in the hand (docs/exhibit-2026-10.md, "Objects in the hand"): a small realtime view of one object, lit
 * simply on a dark ground and turned by dragging, on a leaf whose `interact` is `object:<id>`. Imported lazily, so
 * three.js loads only when such a leaf is reached. The first object is the ghosted head (`objects/heads.json`,
 * written by render/export_heads.py): the as-built king's head solid, the First Time lion's head translucent round
 * it, and H1's enlargement read from the same file.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface HeadsManifest {
  centre: number[];
  objects: { id: string; file: string; role: 'solid' | 'ghost' }[];
  head_scale: { used: number; least: number | null };
  standin: string;
}

/** What the view says of H1 beside the heads: the least enlargement the fit found, or only the renders' choice. */
export function factorLine(m: HeadsManifest): string {
  const { used, least } = m.head_scale;
  return least !== null && least !== undefined
    ? `On these stand-ins the lion's head had to be about ${least.toFixed(2)} times the size drawn from the photographs before the monument's head would fit inside it (H1, a proposal, not yet a claim). The renders use ${used}.`
    : `The lion's head is drawn ${used} times the size of the photographs' lion here, a look choice; the fit that finds the least enlargement was not run for this export.`;
}

const GHOST_OPACITY = 0.26;

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
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a241c, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 6, 8);   // raking from the front left, as a low morning sun
    this.scene.add(sun);
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

  /** Show the heads of `m` (loaded once), the caption beside them. */
  async show(m: HeadsManifest): Promise<void> {
    this.el.hidden = false;
    this.el.querySelector('figcaption')!.textContent = `${factorLine(m)} ${m.standin}`;
    const key = m.objects.map((o) => o.file).join();
    if (this.loaded !== key) {
      this.loaded = key;
      this.group.clear();
      const loader = new GLTFLoader();
      const parts = await Promise.all(m.objects.map(async (o) => {
        const gltf = await loader.loadAsync(new URL(o.file, this.base).href);
        if (o.role === 'ghost') {
          gltf.scene.traverse((n) => {
            const mesh = n as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mt) => {
              const g = (mt as THREE.MeshStandardMaterial).clone();
              g.transparent = true;
              g.opacity = GHOST_OPACITY;
              g.depthWrite = false;
              return g;
            });
            mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
            mesh.renderOrder = 1;   // after the solid head, so the head shows through the ghost
          });
        }
        return gltf.scene;
      }));
      parts.forEach((p) => this.group.add(p));
      // both were exported centred on the head, so the view turns about it; frame the whole of the larger one
      const sphere = new THREE.Box3().setFromObject(this.group).getBoundingSphere(new THREE.Sphere());
      const d = sphere.radius / Math.sin((this.camera.fov / 2) * Math.PI / 180) * 1.05;
      this.camera.position.set(0, 0, d);
      this.camera.near = d / 50;
      this.camera.far = d * 4;
      this.camera.lookAt(0, 0, 0);
      this.turn = { ...this.home };
    }
    this.draw();
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
      this.renderer.render(this.scene, this.camera);
    });
  }
}
