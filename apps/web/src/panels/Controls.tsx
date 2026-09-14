import type { Preset } from '@seked/data/browser';
import { SPHINX_MASSING_LABEL, type Model } from '../model';
import { useView } from '../store';
import {
  CAMERA_MODES,
  CUBIT_MAX,
  CUBIT_MIN,
  CUBIT_STEP,
  LAYERS,
  SECTION_AXES,
  SECTION_MAX,
  SECTION_MIN,
  SECTION_STEP,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  type CameraMode,
  type SectionAxis,
  type Vec3,
} from '../view';

export function PresetPicker({ presets }: { presets: Preset[] }): React.JSX.Element {
  const preset = useView((s) => s.preset);
  const setPreset = useView((s) => s.setPreset);
  const current = presets.find((p) => p.id === preset);
  return (
    <section className="block">
      <label className="field">
        <span className="field-label">Survey preset</span>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {current?.note && <p className="note">{current.note}</p>}
      <p className="note">A preset is an order of preference over sources. Every number downstream is resolved through it.</p>
    </section>
  );
}

/**
 * The royal cubit is a measurement like any other, and several claims turn on
 * it. Sliding it overrides `cubit.royal` in the environment, which re-derives
 * and re-evaluates everything at once.
 */
export function CubitSlider({ model }: { model: Model }): React.JSX.Element {
  const cubit = useView((s) => s.cubit);
  const setCubit = useView((s) => s.setCubit);
  const value = cubit ?? model.measuredCubit;
  return (
    <section className="block">
      <label className="field">
        <span className="field-label">
          Royal cubit <output>{(value * 1000).toFixed(2)} mm</output>
        </span>
        <input
          type="range"
          min={CUBIT_MIN}
          max={CUBIT_MAX}
          step={CUBIT_STEP}
          value={value}
          onChange={(e) => setCubit(Number(e.target.value))}
        />
      </label>
      <p className="note">
        {cubit === null ? (
          <>Measured: {(model.measuredCubit * 1000).toFixed(2)} mm under this preset.</>
        ) : (
          <>
            Overriding the measured {(model.measuredCubit * 1000).toFixed(2)} mm.{' '}
            <button type="button" className="link" onClick={() => setCubit(null)}>
              use the measurement
            </button>
          </>
        )}
      </p>
    </section>
  );
}

/** The data frame turned Y-up, which is the frame the camera lives in. */
const toWorld = ([east, north, up]: Vec3): Vec3 => [east, up, -north];

/**
 * Where the "look inside" button puts the reader: east of the cut and a little
 * south of it, looking west and down at the Grand Gallery, which is the view
 * Plate I is drawn from. The cut itself goes through the passages, whose east
 * offset is a measurement like any other, so the button reads it rather than
 * carrying a number of its own.
 */
function insideView(model: Model): { at: number; position: Vec3; target: Vec3 } | undefined {
  const g1 = model.pyramids.find((p) => p.id === 'g1');
  if (!g1) return undefined;
  const at = model.env['entrance.floor.begin.east'] ?? 0;
  return {
    at,
    position: toWorld([at + 300, -70, 130]),
    target: toWorld([at, -20, 32]),
  };
}

/**
 * The section plane, which is the only way to see inside an opaque pyramid,
 * and the camera it is read with. The plan asks for the interior in section
 * like Petrie's Plate I: that is the north-south plane, put through the
 * passages, looked at from the east.
 */
export function SectionControls({ model }: { model: Model }): React.JSX.Element {
  const section = useView((s) => s.section);
  const setSection = useView((s) => s.setSection);
  const mode = useView((s) => s.mode);
  const setMode = useView((s) => s.setMode);
  const speed = useView((s) => s.speed);
  const setSpeed = useView((s) => s.setSpeed);
  const lookInside = useView((s) => s.lookInside);
  const inside = insideView(model);
  const along = section.axis === 'ns' ? 'east' : 'north';

  return (
    <section className="block">
      <h2>Section and camera</h2>
      <ul className="toggles">
        <li>
          <label>
            <input type="checkbox" checked={section.on} onChange={() => setSection({ on: !section.on })} />
            Section cut
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={section.ground}
              disabled={!section.on}
              onChange={() => setSection({ ground: !section.ground })}
            />
            Cut the plateau too
          </label>
        </li>
      </ul>

      <label className="field">
        <span className="field-label">Cutting plane</span>
        <select value={section.axis} onChange={(e) => setSection({ axis: e.target.value as SectionAxis })} disabled={!section.on}>
          {SECTION_AXES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">
          Position <output>{section.at.toFixed(1)} m {along}</output>
        </span>
        <input
          type="range"
          min={SECTION_MIN}
          max={SECTION_MAX}
          step={SECTION_STEP}
          value={section.at}
          disabled={!section.on}
          onChange={(e) => setSection({ at: Number(e.target.value) })}
        />
      </label>

      {inside && (
        <p className="note">
          <button type="button" className="link" onClick={() => lookInside(inside.at, { position: inside.position, target: inside.target })}>
            Look inside the Great Pyramid
          </button>{' '}
          cuts the north-south plane through the passages, {inside.at.toFixed(2)} m east of the base centre, and looks west at it.
        </p>
      )}

      <label className="field">
        <span className="field-label">Camera</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as CameraMode)}>
          {CAMERA_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">
          Fly speed <output>{speed.toFixed(0)} m/s</output>
        </span>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={speed}
          disabled={mode !== 'fly'}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </label>

      <p className="note">
        {mode === 'fly'
          ? 'Click the scene to take the mouse, WASD to move, Q and E for down and up, Escape to let go.'
          : 'Drag to orbit, scroll to close in. Fly mode walks the passages.'}
      </p>
    </section>
  );
}

export function LayerToggles(): React.JSX.Element {
  const layers = useView((s) => s.layers);
  const toggleLayer = useView((s) => s.toggleLayer);
  return (
    <section className="block">
      <h2>Layers</h2>
      <ul className="toggles">
        {LAYERS.map((layer) => (
          <li key={layer.id}>
            <label>
              <input type="checkbox" checked={layers[layer.id]} onChange={() => toggleLayer(layer.id)} />
              {layer.label}
            </label>
          </li>
        ))}
      </ul>
      <p className="note">
        The terrain is Copernicus GLO-30 at 20 m. Its editing mask smooths the monuments out, so it is context for the plateau and not a
        measurement of anything on it. The ground is that same grid with each footprint set to the surveyed base level and blended back over
        260 m, which is why the monuments sit on it rather than in its mounds. The interior shows where the section cut opens it. The
        pyramids layer also carries the {SPHINX_MASSING_LABEL}: a box of the ARCE survey's length, width and height on a commonly cited
        latitude and longitude worth about 55 m, standing on the Great Pyramid's base level because no elevation for the Sphinx is in the
        database. It is a volume in the right place, not a model of the statue.
      </p>
    </section>
  );
}
