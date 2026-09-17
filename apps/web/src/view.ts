/**
 * The view state and its query string. Everything a reader can change lives
 * here, so a URL is the whole view: preset, cubit, layers, selected claim and
 * camera. The codec is deliberately lossless and deliberately boring.
 */
import { TOUR } from './tour';

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

/**
 * The timeline's four stops. Each is a whole look for every structure and
 * the ground, and carries the epoch the sky defaults to at that stop. `kind`
 * is the honesty word the caption ends with: what the reader is looking at
 * is the survey, a reconstruction, or a claim. Epochs are astronomical years
 * (10,500 BCE is -10499).
 */
export const STATES = [
  { id: 'ancient', label: 'The First Time', kind: 'claim', epoch: -10499 },
  { id: 'built', label: 'As built', kind: 'reconstruction', epoch: -2449 },
  { id: 'stripped', label: 'Stripped and buried', kind: 'reconstruction', epoch: 1500 },
  { id: 'today', label: 'As it stands', kind: 'survey', epoch: 2026 },
] as const;

export type StateId = (typeof STATES)[number]['id'];

export const stateById = (id: StateId): (typeof STATES)[number] => STATES.find((s) => s.id === id) ?? STATES[3];

/**
 * When in the year and the day the sun is looked at: the day of the year
 * (1 to 366) and local mean solar time in hours (0 to 24). The sun's place
 * for it is the sky package's business, never typed here.
 */
export interface Moment {
  day: number;
  hour: number;
}

/**
 * Named moments, the ones the Blender views were rendered at, as days and
 * hours. The days are the 2026 calendar's for the equinoxes and solstices,
 * which is a day or so off in other years and is only a preset.
 */
export const MOMENTS = [
  { id: 'equinox-dawn', label: 'Equinox, an hour after sunrise', moment: { day: 79, hour: 7.1 } },
  { id: 'winter-dusk', label: 'December solstice, an hour before sunset', moment: { day: 355, hour: 16.0 } },
  { id: 'summer-sunset', label: 'June solstice, sunset', moment: { day: 172, hour: 19.0 } },
  { id: 'midnight', label: 'Equinox, midnight', moment: { day: 79, hour: 0 } },
] as const;

/**
 * The claims about the Sphinx's first form, shown in place of the state's
 * own Sphinx when asked for and never by default: the lion (Hancock and
 * Bauval among others) and the recumbent Anubis (Temple). Null is the state's
 * ordinary Sphinx. Each is a `claimed` structure and is drawn as one.
 */
export const SPHINX_VARIANTS = [
  { id: 'lion', label: 'A lion (claim)' },
  { id: 'anubis', label: 'Anubis (claim)' },
] as const;

export type SphinxVariant = (typeof SPHINX_VARIANTS)[number]['id'];

export const DAY_MIN = 1;
export const DAY_MAX = 366;
export const HOUR_MIN = 0;
export const HOUR_MAX = 24;

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
  /** Which tour step is showing, or null when no tour is running. */
  tour: number | null;
  /** The timeline stop every structure is drawn at. */
  state: StateId;
  /** The day and hour the sun is drawn for. */
  moment: Moment;
  /** A claim's Sphinx in place of the state's own, or null for the state's. */
  sphinx: SphinxVariant | null;
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
  tour: null,
  state: 'today',
  moment: { day: 355, hour: 16.0 },
  sphinx: null,
};

const isSphinxVariant = (id: string | null): id is SphinxVariant => SPHINX_VARIANTS.some((v) => v.id === id);

const isStateId = (id: string | null): id is StateId => STATES.some((s) => s.id === id);

/** `day,hour` as `encodeView` writes it, falling back field by field. */
export function decodeMoment(text: string | null): Moment {
  if (text === null) return DEFAULT_VIEW.moment;
  const [d, h] = text.split(',').map(Number);
  return {
    day: Number.isFinite(d) ? clamp(Math.round(d as number), DAY_MIN, DAY_MAX) : DEFAULT_VIEW.moment.day,
    hour: Number.isFinite(h) ? clamp(h as number, HOUR_MIN, HOUR_MAX) : DEFAULT_VIEW.moment.hour,
  };
}

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
 * one, else the selected claim's own epoch, else the timeline stop's own. So
 * selecting a sky claim snaps the sky to the epoch that claim is stated at,
 * moving the timeline takes the sky with it, and dragging the slider takes it
 * from there.
 */
export function sceneEpoch(override: number | null, claimEpoch: number | undefined, stateEpoch: number = DEFAULT_EPOCH): number {
  return override ?? claimEpoch ?? stateEpoch;
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
  // A missing key has to decode to NaN and not to the zero `Number(null)`
  // gives, because zero is a value each of these fields would then clamp and
  // keep instead of falling back to its default.
  const lst = q.get('lst') === null ? Number.NaN : Number(q.get('lst'));
  const layerList = q.get('layers');
  const cam = numbers(q.get('cam'), 6);
  const mode = q.get('mode');
  const speed = q.get('speed') === null ? Number.NaN : Number(q.get('speed'));
  const index = q.get('tour') === null ? Number.NaN : Number(q.get('tour'));
  const tour = Number.isInteger(index) && index >= 0 && index < TOUR.length ? index : null;
  // A camera in the query string wins over the tour's, so a shared link
  // reproduces the view its author was looking at rather than the step's
  // canonical one. A hand-written `?tour=N` carries no camera, and then the
  // step's own is the sensible fallback rather than the opening view.
  const framing = (tour === null ? undefined : TOUR[tour]?.camera) ?? DEFAULT_VIEW.camera;
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
      : framing,
    mode: mode === 'fly' || mode === 'orbit' ? mode : DEFAULT_VIEW.mode,
    speed: Number.isFinite(speed) ? clamp(speed, SPEED_MIN, SPEED_MAX) : DEFAULT_VIEW.speed,
    section: decodeSection(q.get('cut')),
    tour,
    state: isStateId(q.get('state')) ? (q.get('state') as StateId) : DEFAULT_VIEW.state,
    moment: decodeMoment(q.get('moment')),
    sphinx: isSphinxVariant(q.get('sphinx')) ? (q.get('sphinx') as SphinxVariant) : null,
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
  if (view.tour !== null) q.set('tour', String(view.tour));
  q.set('state', view.state);
  q.set('moment', `${round(view.moment.day, 0)},${round(view.moment.hour, 2)}`);
  if (view.sphinx !== null) q.set('sphinx', view.sphinx);
  return `?${q.toString()}`;
}
