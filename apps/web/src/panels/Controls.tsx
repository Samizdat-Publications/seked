import type { Preset } from '@seked/data/browser';
import type { Model } from '../model';
import { useView } from '../store';
import { CUBIT_MAX, CUBIT_MIN, CUBIT_STEP, LAYERS } from '../view';

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
        260 m, which is why the monuments sit on it rather than in its mounds. The interior shows where the section cut opens it.
      </p>
    </section>
  );
}
