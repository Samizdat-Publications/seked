/**
 * The view state and its query string. Everything a reader can change lives
 * here, so a URL is the whole view: preset, cubit, layers, selected claim and
 * camera. The codec is deliberately lossless and deliberately boring.
 */
export const LAYERS = [
  { id: 'pyramids', label: 'Pyramids as built' },
  { id: 'today', label: 'Today (truncated)' },
  { id: 'interior', label: 'Interior' },
  { id: 'ground', label: 'Ground (flattened)' },
  { id: 'terrain', label: 'Terrain (GLO-30 context)' },
  { id: 'grid', label: 'Grid' },
  { id: 'north', label: 'North arrow' },
  { id: 'overlay', label: 'Claim overlay' },
] as const;

export type LayerId = (typeof LAYERS)[number]['id'];

export type Vec3 = [number, number, number];

/**
 * Camera and target in three's world frame, which is the data frame turned
 * Y-up: +X east, +Y up, +Z south.
 */
export interface CameraView {
  position: Vec3;
  target: Vec3;
}

/** Orbit a pivot, or fly with WASD and the mouse. */
export type CameraMode = 'orbit' | 'fly';

export const CAMERA_MODES = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'fly', label: 'Fly' },
] as const;

/**
 * Which vertical plane the section cuts with. `ns` is the north-south plane,
 * the one Petrie draws Plate I on, so its position is an east coordinate and
 * everything east of it goes; `ew` is the east-west plane, whose position is a
 * north coordinate and which takes everything north of it.
 */
export type SectionAxis = 'ns' | 'ew';

export const SECTION_AXES = [
  { id: 'ns', label: 'North-south (Plate I)' },
  { id: 'ew', label: 'East-west' },
] as const;

export interface Section {
  on: boolean;
  axis: SectionAxis;
  /** Metres east for the north-south plane, metres north for the east-west one. */
  at: number;
  /** Cut the plateau grids as well, rather than only the masonry. */
  ground: boolean;
}

export interface View {
  preset: string;
  /** Royal cubit override in metres, or null for the value the preset resolves. */
  cubit: number | null;
  layers: Record<LayerId, boolean>;
  claim: string | null;
  camera: CameraView;
  mode: CameraMode;
  /** Metres per second in fly mode. */
  speed: number;
  section: Section;
}

export const CUBIT_MIN = 0.52;
export const CUBIT_MAX = 0.53;
export const CUBIT_STEP = 0.00005;

// Far enough west and south to clear G3, far enough east and north to clear
// G1, which is the whole range a cut through the three pyramids needs.
export const SECTION_MIN = -800;
export const SECTION_MAX = 200;
export const SECTION_STEP = 0.5;

export const SPEED_MIN = 2;
export const SPEED_MAX = 400;
export const SPEED_STEP = 1;

export const DEFAULT_VIEW: View = {
  preset: 'canonical',
  cubit: null,
  layers: {
    pyramids: true,
    today: false,
    interior: true,
    ground: true,
    terrain: false,
    grid: true,
    north: true,
    overlay: true,
  },
  claim: null,
  camera: { position: [980, 780, 1520], target: [-250, 30, 350] },
  mode: 'orbit',
  speed: 40,
  section: { on: false, axis: 'ns', at: 0, ground: false },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function numbers(text: string | null, count: number): number[] | undefined {
  if (!text) return undefined;
  const parts = text.split(',').map(Number);
  return parts.length === count && parts.every((n) => Number.isFinite(n)) ? parts : undefined;
}

/** `axis,position,ground` or "off", the way `encodeView` writes the cut. */
function decodeSection(text: string | null): Section {
  if (text === null) return DEFAULT_VIEW.section;
  const [axis, at, ground] = text.split(',');
  if (axis !== 'ns' && axis !== 'ew') return DEFAULT_VIEW.section;
  const position = Number(at);
  return {
    on: true,
    axis,
    at: Number.isFinite(position) ? clamp(position, SECTION_MIN, SECTION_MAX) : DEFAULT_VIEW.section.at,
    ground: ground === '1',
  };
}

/** Read a view out of a query string, falling back to the default field by field. */
export function decodeView(search: string, presetIds: string[]): View {
  const q = new URLSearchParams(search);
  const preset = q.get('preset');
  const cubit = q.get('cubit') === null ? Number.NaN : Number(q.get('cubit'));
  const layerList = q.get('layers');
  const cam = numbers(q.get('cam'), 6);
  const mode = q.get('mode');
  const speed = Number(q.get('speed'));
  const layers = { ...DEFAULT_VIEW.layers };
  if (layerList !== null) {
    const on = new Set(layerList.split(',').filter(Boolean));
    for (const layer of LAYERS) layers[layer.id] = on.has(layer.id);
  }
  return {
    preset: preset && presetIds.includes(preset) ? preset : DEFAULT_VIEW.preset,
    cubit: Number.isFinite(cubit) ? clamp(cubit, CUBIT_MIN, CUBIT_MAX) : null,
    layers,
    claim: q.get('claim'),
    camera: cam
      ? { position: [cam[0] as number, cam[1] as number, cam[2] as number], target: [cam[3] as number, cam[4] as number, cam[5] as number] }
      : DEFAULT_VIEW.camera,
    mode: mode === 'fly' || mode === 'orbit' ? mode : DEFAULT_VIEW.mode,
    speed: Number.isFinite(speed) ? clamp(speed, SPEED_MIN, SPEED_MAX) : DEFAULT_VIEW.speed,
    section: decodeSection(q.get('cut')),
  };
}

const round = (v: number, digits: number): string => {
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/** The query string for a view, "?" included. Metres to a decimetre; a cubit to a tenth of a millimetre. */
export function encodeView(view: View): string {
  const q = new URLSearchParams();
  q.set('preset', view.preset);
  if (view.cubit !== null) q.set('cubit', view.cubit.toFixed(5));
  q.set('layers', LAYERS.filter((l) => view.layers[l.id]).map((l) => l.id).join(','));
  if (view.claim) q.set('claim', view.claim);
  q.set('cam', [...view.camera.position, ...view.camera.target].map((n) => round(n, 1)).join(','));
  q.set('mode', view.mode);
  q.set('speed', round(view.speed, 0));
  q.set('cut', view.section.on ? `${view.section.axis},${round(view.section.at, 1)},${view.section.ground ? '1' : '0'}` : 'off');
  return `?${q.toString()}`;
}
