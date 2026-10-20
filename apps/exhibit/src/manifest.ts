/**
 * The walkthrough's manifests, read as the exhibit needs them: `stations.json` (render/publish.py) and
 * `overlays.json` (3D lines in project metres, computed by render/publish.py from the survey numbers).
 * Both are tolerant readers: a malformed entry is dropped, never guessed at.
 */
import { DEG, type Patch, type Vec3 } from './projection';

export interface State { id: string; label: string; title: string; honesty: string; note: string }

export interface Station {
  id: string;
  name: string;
  where: string;
  moment: string;
  camera: Vec3;
  /** Where the camera stood in an era, when that differs (on a boat where the ground is flooded). */
  cameras: Record<string, Vec3>;
  /** The view the station opens on, in radians. */
  view: { yaw: number; pitch: number; fov: number };
  /** Era id to panorama path, relative to the manifest. */
  panoramas: Record<string, string>;
  /** The eras this station has, oldest first. */
  eras: string[];
  patches: Record<string, Patch[]>;
}

export interface Manifest { states: State[]; stateById: Record<string, State>; stations: Station[]; byId: Record<string, Station> }

const num = (v: unknown, d: number): number => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? n : d;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const vec3 = (v: unknown): Vec3 | null => {
  const a = arr(v);
  return a.length === 3 && a.every((x) => x !== null && Number.isFinite(Number(x))) ? [Number(a[0]), Number(a[1]), Number(a[2])] : null;
};

export function readManifest(raw: unknown): Manifest {
  const m = obj(raw);
  const states: State[] = arr(m.states).map(obj).filter((s) => s.id).map((s) => ({
    id: String(s.id), label: String(s.label ?? s.id), title: String(s.title ?? s.id), honesty: String(s.honesty ?? ''), note: s.note ? String(s.note) : '',
  }));
  const stateById = Object.fromEntries(states.map((s) => [s.id, s]));
  const stations: Station[] = arr(m.stations).map(obj).filter((s) => s.id).map((s) => {
    const pan = Object.fromEntries(Object.entries(obj(s.panoramas)).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, v as string]));
    const v = obj(s.view);
    const cameras: Record<string, Vec3> = {};
    for (const [k, c] of Object.entries(obj(s.cameras))) { const x = vec3(c); if (x) cameras[k] = x; }
    const patches: Record<string, Patch[]> = {};
    for (const [k, list] of Object.entries(obj(s.patches))) {
      patches[k] = arr(list).map(obj).filter((p) => typeof p.src === 'string').map((p) => ({
        src: p.src as string, yaw: num(p.yaw, 0) * DEG, pitch: num(p.pitch, 0) * DEG, fov: num(p.fov, 50) * DEG, aspect: num(p.aspect, 2),
      }));
    }
    return {
      id: String(s.id), name: String(s.name ?? s.id), where: String(s.where ?? ''), moment: String(s.moment ?? ''),
      camera: vec3(s.camera) ?? [0, 0, 0], cameras,
      view: { yaw: num(v.yaw, 0) * DEG, pitch: num(v.pitch, 0) * DEG, fov: num(v.fov, 58) * DEG },
      panoramas: pan,
      eras: states.filter((x) => pan[x.id]).map((x) => x.id),
      patches,
    };
  });
  return { states, stateById, stations, byId: Object.fromEntries(stations.map((s) => [s.id, s])) };
}

/** The camera for a station in an era: its own for that era if it has one, else the station's. */
export const cameraFor = (st: Station, era: string): Vec3 => st.cameras[era] ?? st.camera;

/**
 * The era to show a station in: the one asked for if it has it, else the nearest it has in the manifest's
 * order (the newer of two equally near), else today, else its newest.
 */
export function pickEra(m: Manifest, st: Station, era: string | null): string | null {
  if (!st.eras.length) return null;
  if (era && st.eras.includes(era)) return era;
  const order = m.states.map((s) => s.id);
  const g = era ? order.indexOf(era) : -1;
  if (g < 0) return st.eras.includes('today') ? 'today' : st.eras[st.eras.length - 1] as string;
  let best = st.eras[0] as string, bestD = Infinity;
  for (const id of st.eras) {
    const d = Math.abs(order.indexOf(id) - g);
    if (d <= bestD) { bestD = d; best = id; }
  }
  return best;
}

/** A point in an overlay: [x, y, z] in the frame, or a bearing from the camera (azimuth, altitude, metres). */
export type OverlayPoint = Vec3 | { dir: Vec3 };
export interface OverlayLine { id?: string; from: OverlayPoint; to: OverlayPoint; style: 'edge' | 'dash' | 'faint' }
export interface OverlayLabel { id?: string; at: OverlayPoint; text: string; sub?: string; place?: string; dy?: number; eras?: string[] }
export interface OverlaySun { at: OverlayPoint; from?: OverlayPoint; radius: number; seconds?: number }
export interface Overlay { lines: OverlayLine[]; labels: OverlayLabel[]; suns: OverlaySun[] }

const point = (v: unknown): OverlayPoint | null => {
  const p = vec3(v);
  if (p) return p;
  const d = vec3(obj(v).dir);
  return d ? { dir: d } : null;
};

export function readOverlays(raw: unknown): Record<string, Overlay> {
  const out: Record<string, Overlay> = {};
  for (const [k, v] of Object.entries(obj(raw))) {
    const o = obj(v);
    const lines: OverlayLine[] = [];
    for (const L of arr(o.lines).map(obj)) {
      const from = point(L.from), to = point(L.to);
      if (!from || !to) continue;
      const style = L.style === 'edge' || L.style === 'faint' ? L.style : 'dash';
      lines.push({ ...(typeof L.id === 'string' ? { id: L.id } : {}), from, to, style });
    }
    const labels: OverlayLabel[] = [];
    for (const L of arr(o.labels).map(obj)) {
      const at = point(L.at);
      if (!at || typeof L.text !== 'string') continue;
      labels.push({
        at, text: L.text,
        ...(typeof L.id === 'string' ? { id: L.id } : {}),
        ...(typeof L.sub === 'string' ? { sub: L.sub } : {}),
        ...(typeof L.place === 'string' ? { place: L.place } : {}),
        ...(typeof L.dy === 'number' ? { dy: L.dy } : {}),
        ...(Array.isArray(L.eras) ? { eras: L.eras.map(String) } : {}),
      });
    }
    const suns: OverlaySun[] = [];
    for (const S of arr(o.suns).map(obj)) {
      const at = point(S.at);
      if (!at) continue;
      const from = point(S.from);
      suns.push({ at, radius: num(S.radius, 8), ...(from ? { from } : {}), ...(typeof S.seconds === 'number' ? { seconds: S.seconds } : {}) });
    }
    out[k] = { lines, labels, suns };
  }
  return out;
}
