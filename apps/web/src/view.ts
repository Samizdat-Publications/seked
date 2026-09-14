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

export interface View {
  preset: string;
  /** Royal cubit override in metres, or null for the value the preset resolves. */
  cubit: number | null;
  layers: Record<LayerId, boolean>;
  claim: string | null;
  camera: CameraView;
}

export const CUBIT_MIN = 0.52;
export const CUBIT_MAX = 0.53;
export const CUBIT_STEP = 0.00005;

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
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function numbers(text: string | null, count: number): number[] | undefined {
  if (!text) return undefined;
  const parts = text.split(',').map(Number);
  return parts.length === count && parts.every((n) => Number.isFinite(n)) ? parts : undefined;
}

/** Read a view out of a query string, falling back to the default field by field. */
export function decodeView(search: string, presetIds: string[]): View {
  const q = new URLSearchParams(search);
  const preset = q.get('preset');
  const cubit = q.get('cubit') === null ? Number.NaN : Number(q.get('cubit'));
  const layerList = q.get('layers');
  const cam = numbers(q.get('cam'), 6);
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
  return `?${q.toString()}`;
}
