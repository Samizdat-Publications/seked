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
  { id: 'sky', label: 'Sky (stars of the epoch)' },
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
  /**
   * Julian epoch the sky is drawn at and every dated claim is evaluated at,
   * or null to let each claim keep its own epoch and the sky follow whichever
   * claim is selected. Astronomical year numbering: 2450 BCE is -2449.
   */
  epoch: number | null;
  /** Local apparent sidereal time as an angle, 0 to 360 degrees. */
  lst: number;
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

// Back to 12,000 BCE, which covers every epoch the claims reach for, and
// forward to the present. Vondrak 2011 is good for a hundred times this span;
// the catalogue's linear proper motion is what sets the honest limit.
export const EPOCH_MIN = -12000;
export const EPOCH_MAX = 2026;
export const EPOCH_STEP = 1;

/**
 * The sky the viewer opens on when no claim is selected and nothing is
 * overridden: 2450 BCE, the epoch C2 is stated at and the one the monument
 * itself is usually dated to.
 */
export const DEFAULT_EPOCH = -2449;

export const LST_MIN = 0;
export const LST_MAX = 360;
export const LST_STEP = 0.25;

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
  epoch: null,
  lst: 0,
  layers: {
    pyramids: true,
    today: false,
    interior: true,
    ground: true,
    terrain: false,
    grid: true,
    north: true,
    sky: false,
    overlay: true,
  },
  claim: null,
  camera: { position: [980, 780, 1520], target: [-250, 30, 350] },
  mode: 'orbit',
  speed: 40,
  section: { on: false, axis: 'ns', at: 0, ground: false },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Sidereal time is an angle on a circle, so it wraps rather than clamping:
 * dragging past 360 comes back to 0 and the sky keeps turning the same way.
 */
export function normaliseLst(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * The epoch the scene is actually drawn at: the reader's override if there is
 * one, else the selected claim's own epoch, else the default. So selecting a
 * sky claim snaps the sky to the epoch that claim is stated at, and dragging
 * the slider takes it from there.
 */
export function sceneEpoch(override: number | null, claimEpoch: number | undefined): number {
  return override ?? claimEpoch ?? DEFAULT_EPOCH;
}

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
  const epoch = q.get('epoch') === null ? Number.NaN : Number(q.get('epoch'));
  const lst = Number(q.get('lst'));
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
    epoch: Number.isFinite(epoch) ? clamp(epoch, EPOCH_MIN, EPOCH_MAX) : null,
    lst: Number.isFinite(lst) ? normaliseLst(lst) : DEFAULT_VIEW.lst,
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
  if (view.epoch !== null) q.set('epoch', round(view.epoch, 0));
  q.set('lst', round(view.lst, 2));
  q.set('layers', LAYERS.filter((l) => view.layers[l.id]).map((l) => l.id).join(','));
  if (view.claim) q.set('claim', view.claim);
  q.set('cam', [...view.camera.position, ...view.camera.target].map((n) => round(n, 1)).join(','));
  q.set('mode', view.mode);
  q.set('speed', round(view.speed, 0));
  q.set('cut', view.section.on ? `${view.section.axis},${round(view.section.at, 1)},${view.section.ground ? '1' : '0'}` : 'off');
  return `?${q.toString()}`;
}
